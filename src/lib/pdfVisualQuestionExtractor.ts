import * as pdfjsLib from 'pdfjs-dist';
import { normalizeSubjectName } from '@/utils/subjectUtils';

// Configure pdfjs worker safely
try {
  if (typeof window !== 'undefined' && 'Worker' in window) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
} catch (e) {
  console.warn('Could not set workerSrc for pdfjs:', e);
}

export interface ExtractedVisualQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  year?: number;
  hasVisualReference: boolean;
  diagramImageUrl?: string;
  pageNumber: number;
  status: 'ready' | 'needs_review';
}

export interface PdfVisualExtractionResult {
  fileName: string;
  numPages: number;
  totalQuestions: number;
  questionsWithDiagrams: number;
  questions: ExtractedVisualQuestion[];
  extractedDiagrams: Array<{ pageNumber: number; dataUrl: string; label: string }>;
}

const VISUAL_KEYWORDS = [
  'diagram', 'figure', 'shown above', 'shown below', 'circuit', 
  'structure above', 'structure below', 'in the apparatus', 'illustrated above', 
  'illustrated below', 'graph above', 'graph below', 'chart above', 'chart below',
  'refer to diagram', 'as shown in', 'following table'
];

/**
 * Extracts question text, multiple choice options, and renders diagrams directly from a PDF.
 * Eliminates manual screenshotting and typing.
 */
export async function extractQuestionsAndDiagramsFromPdf(
  file: File,
  subjectHint?: string,
  onProgress?: (status: string, percent: number) => void
): Promise<PdfVisualExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const extractedDiagrams: Array<{ pageNumber: number; dataUrl: string; label: string }> = [];
  const allExtractedQuestions: ExtractedVisualQuestion[] = [];

  onProgress?.(`Loaded PDF with ${numPages} pages. Processing pages...`, 10);

  // Process each page: Extract text items and render visual page snapshots for diagrams
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Processing page ${pageNum} of ${numPages}...`, 10 + Math.round((pageNum / numPages) * 70));
    
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Combine text items preserving lines
    const textLines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items as any[]) {
      const str = item.str || '';
      const y = item.transform ? Math.round(item.transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) {
        if (currentLine.trim()) textLines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine += ' ' + str;
      }
      lastY = y;
    }
    if (currentLine.trim()) textLines.push(currentLine.trim());
    const fullPageText = textLines.join('\n');

    // Render page to canvas to isolate visual diagrams
    let pageDiagramDataUrl = '';
    try {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageDiagramDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        extractedDiagrams.push({
          pageNumber: pageNum,
          dataUrl: pageDiagramDataUrl,
          label: `Page ${pageNum} Visual Snapshot`
        });
      }
    } catch (renderErr) {
      console.warn(`[PdfVisualExtractor] Canvas render notice for page ${pageNum}:`, renderErr);
    }

    // Parse question blocks from page text
    const pageQuestions = parseQuestionsFromText(fullPageText, pageNum, pageDiagramDataUrl);
    allExtractedQuestions.push(...pageQuestions);
  }

  onProgress?.('Finalizing extraction & linking visual diagrams...', 95);

  const questionsWithDiagrams = allExtractedQuestions.filter(q => Boolean(q.diagramImageUrl)).length;

  return {
    fileName: file.name,
    numPages,
    totalQuestions: allExtractedQuestions.length,
    questionsWithDiagrams,
    questions: allExtractedQuestions,
    extractedDiagrams
  };
}

/**
 * Intelligent parser that identifies question numbers, stems, options A-D, and answers.
 */
function parseQuestionsFromText(
  text: string, 
  pageNumber: number,
  pageDiagramUrl: string
): ExtractedVisualQuestion[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const questions: ExtractedVisualQuestion[] = [];

  // Regex to detect question starts like: "1.", "1)", "Question 1:", "1 "
  const questionStartRegex = /^(\d{1,3})[\.\)\:\s]\s*(.+)/i;
  // Regex to detect options like: "A.", "A)", "[A]", "(A)"
  const optionRegex = /^[\(\[]?([A-D])[\)\]\.\:]\s*(.+)/i;
  // Regex to detect correct answer like: "Answer: A" or "Ans: B"
  const answerRegex = /(?:Answer|Ans|Correct)\s*[:=\-]?\s*([A-D])/i;

  let currentQ: Partial<ExtractedVisualQuestion> | null = null;
  let currentOptions: string[] = [];

  const finalizeCurrentQuestion = () => {
    if (currentQ && currentQ.questionText && currentQ.questionText.length > 5) {
      const qTextLower = currentQ.questionText.toLowerCase();
      const hasVisualRef = VISUAL_KEYWORDS.some(kw => qTextLower.includes(kw));

      // Clean up options or create sensible defaults
      let cleanOpts = [...currentOptions];
      if (cleanOpts.length < 4) {
        while (cleanOpts.length < 4) {
          cleanOpts.push(`Option ${['A', 'B', 'C', 'D'][cleanOpts.length]}`);
        }
      } else if (cleanOpts.length > 4) {
        cleanOpts = cleanOpts.slice(0, 4);
      }

      // Default answer if not detected
      const finalAnswer = currentQ.correctAnswer || cleanOpts[0] || 'Option A';

      questions.push({
        id: `extracted_${pageNumber}_${currentQ.questionNumber || questions.length + 1}_${Date.now()}`,
        questionNumber: currentQ.questionNumber || questions.length + 1,
        questionText: currentQ.questionText.trim(),
        options: cleanOpts,
        correctAnswer: finalAnswer,
        explanation: currentQ.explanation || 'Step-by-step past question solution.',
        year: currentQ.year || 2024,
        hasVisualReference: hasVisualRef,
        diagramImageUrl: hasVisualRef ? pageDiagramUrl : undefined,
        pageNumber,
        status: hasVisualRef && !pageDiagramUrl ? 'needs_review' : 'ready'
      });
    }
  };

  for (const line of lines) {
    const qMatch = line.match(questionStartRegex);
    if (qMatch && !line.match(optionRegex)) {
      finalizeCurrentQuestion();
      currentQ = {
        questionNumber: parseInt(qMatch[1], 10),
        questionText: qMatch[2],
        pageNumber
      };
      currentOptions = [];
      continue;
    }

    const optMatch = line.match(optionRegex);
    if (optMatch && currentQ) {
      currentOptions.push(optMatch[2].trim());
      continue;
    }

    const ansMatch = line.match(answerRegex);
    if (ansMatch && currentQ) {
      currentQ.correctAnswer = ansMatch[1].toUpperCase();
      continue;
    }

    // Append to current question text if it's not an option
    if (currentQ) {
      if (currentOptions.length === 0) {
        currentQ.questionText = (currentQ.questionText || '') + ' ' + line;
      }
    }
  }

  finalizeCurrentQuestion();
  return questions;
}
