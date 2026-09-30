import * as pdfjsLib from 'pdfjs-dist';
import { normalizeSubjectName } from '@/utils/subjectUtils';

// Configure pdfjs worker dynamically to match the exact installed pdfjs-dist runtime version
try {
  if (typeof window !== 'undefined') {
    const installedVersion = (pdfjsLib as any).version || '6.2.108';
    // Use jsdelivr matching the exact API version of pdfjs-dist
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${installedVersion}/build/pdf.worker.min.mjs`;
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
 * Intelligent parser that identifies question numbers, stems, options A-D, answers, and year tags.
 * Specially tuned for JAMB Series Remix (grouped by topics and years per question) and standard UTME past papers.
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
  // Regex to detect topic headers like: "TOPIC 1: Organic Chemistry", "Chapter 3: Motion"
  const topicHeaderRegex = /(?:TOPIC|CHAPTER|SECTION)\s*(?:\d+)?\s*[:\-–]?\s*([A-Za-z\s,\-&]{3,50})/i;
  // Regex to detect per-question year tags (e.g. [JAMB 2018 Q14], (UTME 2022/3), [2004], (1998 No. 5))
  const yearTagRegex = /(?:\[|\(|\b)(?:JAMB|UTME|UME|SSCE|WAEC|NECO)?\s*(19[7-9]\d|20[0-2]\d)\s*(?:[\/,]\s*(?:Q|No\.?|Question)?\s*\d+)?\s*(?:\]|\)|\b)/i;

  let currentTopic = '';
  let currentQ: Partial<ExtractedVisualQuestion> | null = null;
  let currentOptions: string[] = [];

  const finalizeCurrentQuestion = () => {
    if (currentQ && currentQ.questionText && currentQ.questionText.length > 5) {
      let rawText = currentQ.questionText.trim();
      let extractedYear = currentQ.year;

      // Extract year tag from question stem if present (e.g., "[JAMB 2021 Q4] What is the formula...")
      const stemYearMatch = rawText.match(yearTagRegex);
      if (stemYearMatch && stemYearMatch[1]) {
        extractedYear = parseInt(stemYearMatch[1], 10);
        // Clean out leading/trailing bracketed year tags from stem
        rawText = rawText.replace(yearTagRegex, '').replace(/^[\s:\-\.–]+/, '').trim();
      }

      const qTextLower = rawText.toLowerCase();
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
        questionText: rawText,
        options: cleanOpts,
        correctAnswer: finalAnswer,
        explanation: currentQ.explanation || (currentTopic ? `JAMB Past Question Solution (${currentTopic}).` : 'Step-by-step past question solution.'),
        year: extractedYear || 2024,
        hasVisualReference: hasVisualRef,
        diagramImageUrl: hasVisualRef ? pageDiagramUrl : undefined,
        pageNumber,
        status: hasVisualRef && !pageDiagramUrl ? 'needs_review' : 'ready'
      });
    }
  };

  for (const line of lines) {
    // Check for Topic / Chapter header in page
    const topMatch = line.match(topicHeaderRegex);
    if (topMatch && topMatch[1]) {
      currentTopic = topMatch[1].trim();
      continue;
    }

    const qMatch = line.match(questionStartRegex);
    if (qMatch && !line.match(optionRegex)) {
      finalizeCurrentQuestion();
      
      let stem = qMatch[2].trim();
      let detectedYear: number | undefined = undefined;
      const yMatch = stem.match(yearTagRegex);
      if (yMatch && yMatch[1]) {
        detectedYear = parseInt(yMatch[1], 10);
      }

      currentQ = {
        questionNumber: parseInt(qMatch[1], 10),
        questionText: stem,
        year: detectedYear,
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

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Renders all pages of a PDF into high-resolution images for visual inspection and cropping.
 */
export async function renderPdfPagesForVisualSnapping(
  file: File,
  scale = 1.8,
  onProgress?: (current: number, total: number) => void
): Promise<RenderedPdfPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages: RenderedPdfPage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push({
        pageNumber: pageNum,
        dataUrl: canvas.toDataURL('image/jpeg', 0.90),
        width: viewport.width,
        height: viewport.height
      });
    }
  }

  return pages;
}

/**
 * Crops a bounding region from a base64 image data URL and returns the cropped image.
 */
export function cropRegionFromPageDataUrl(
  pageDataUrl: string,
  cropArea: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(10, Math.round(cropArea.width));
        canvas.height = Math.max(10, Math.round(cropArea.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not create canvas 2D context');
        }

        ctx.drawImage(
          img,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load base image for cropping'));
    img.src = pageDataUrl;
  });
}
