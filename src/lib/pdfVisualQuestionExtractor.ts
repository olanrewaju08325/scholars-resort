import * as pdfjsLib from 'pdfjs-dist';
import { normalizeSubjectName, OFFICIAL_JAMB_SUBJECTS } from '@/utils/subjectUtils';

// Configure pdfjs worker dynamically with fallback
try {
  if (typeof window !== 'undefined') {
    const installedVersion = (pdfjsLib as any).version || '6.2.108';
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${installedVersion}/build/pdf.worker.min.mjs`;
    }
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
  subject?: string;
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
  detectedSubject: string;
  detectedSubjectConfidence: number;
  isChemistry: boolean;
  questions: ExtractedVisualQuestion[];
  extractedDiagrams: Array<{ pageNumber: number; dataUrl: string; label: string }>;
}

const VISUAL_KEYWORDS = [
  'diagram', 'figure', 'fig.', 'fig ', 'shown above', 'shown below', 'circuit', 
  'structure above', 'structure below', 'in the apparatus', 'illustrated above', 
  'illustrated below', 'graph above', 'graph below', 'chart above', 'chart below',
  'refer to diagram', 'as shown in', 'following table', 'formula above', 'setup above',
  'titration', 'beaker', 'flask', 'burner', 'galvanometer', 'ammeter', 'voltmeter'
];

/**
 * Authoritative 20-Subject JAMB Domain Vocabulary Classifier
 */
const JAMB_SUBJECT_KEYWORDS: Record<string, { weightWords: string[]; titleTriggers: string[] }> = {
  'Chemistry': {
    titleTriggers: ['chemistry', 'chm', 'chem'],
    weightWords: [
      'acid', 'base', 'oxidation', 'reduction', 'redox', 'mole', 'molar', 'molarity', 'electrolysis',
      'cathode', 'anode', 'electrolyte', 'alkane', 'alkene', 'alkyne', 'benzene', 'hydrocarbon',
      'periodic table', 'halogen', 'allotrope', 'precipitate', 'titration', 'indicator', 'catalyst',
      'equilibrium', 'enthalpy', 'endothermic', 'exothermic', 'distillation', 'apparatus', 'compound',
      'reaction', 'valency', 'covalent', 'ionic', 'orbital', 'ester', 'alcohol', 'isomer', 'fractional'
    ]
  },
  'Physics': {
    titleTriggers: ['physics', 'phy'],
    weightWords: [
      'velocity', 'acceleration', 'resistor', 'resistance', 'circuit', 'current', 'voltage', 'potential difference',
      'capacitance', 'refraction', 'reflection', 'lens', 'mirror', 'frequency', 'wavelength', 'amplitude',
      'gravity', 'newton', 'friction', 'momentum', 'torque', 'thermodynamics', 'kinetic energy', 'potential energy',
      'magnetic field', 'flux', 'transformer', 'radioactivity', 'half-life', 'isotope', 'sound wave', 'optics'
    ]
  },
  'Biology': {
    titleTriggers: ['biology', 'bio'],
    weightWords: [
      'photosynthesis', 'chlorophyll', 'respiration', 'mitosis', 'meiosis', 'chromosome', 'dna', 'rna',
      'organism', 'cell', 'mitochondria', 'membrane', 'enzyme', 'digestive', 'circulatory', 'pollination',
      'ecology', 'habitat', 'ecosystem', 'trophic', 'evolution', 'taxonomy', 'phylum', 'vertebrate', 'mammal',
      'parasite', 'bacteria', 'fungi', 'homeostasis', 'heredity', 'genetics', 'osmosis', 'diffusion'
    ]
  },
  'Mathematics': {
    titleTriggers: ['mathematics', 'maths', 'math'],
    weightWords: [
      'quadratic', 'logarithm', 'polynomial', 'matrix', 'matrices', 'determinant', 'trigonometry', 'sine',
      'cosine', 'tangent', 'calculus', 'differentiation', 'derivative', 'integration', 'probability',
      'permutation', 'combination', 'geometric progression', 'arithmetic progression', 'indices', 'surds',
      'circle theorem', 'simultaneous equations', 'bearing', 'elevation', 'depression', 'standard deviation'
    ]
  },
  'Use of English': {
    titleTriggers: ['use of english', 'english language', 'general english'],
    weightWords: [
      'comprehension', 'passage', 'nearest in meaning', 'opposite in meaning', 'antonym', 'synonym',
      'vowel', 'consonant', 'stress pattern', 'syllable', 'rhyme', 'register', 'idiom', 'clause',
      'sentence', 'grammatical', 'punctuation', 'underline', 'most appropriate interpretation'
    ]
  },
  'Economics': {
    titleTriggers: ['economics', 'econs'],
    weightWords: [
      'demand', 'supply', 'elasticity', 'monopoly', 'inflation', 'gdp', 'gnp', 'fiscal', 'monetary policy',
      'utility', 'production function', 'central bank', 'balance of payment', 'market structure', 'opportunity cost'
    ]
  },
  'Government': {
    titleTriggers: ['government', 'govt'],
    weightWords: [
      'constitution', 'democracy', 'federalism', 'sovereignty', 'electoral', 'judiciary', 'legislature',
      'executive', 'colonial rule', 'indirect rule', 'political party', 'citizenship', 'republic', 'separation of powers'
    ]
  },
  'Literature in English': {
    titleTriggers: ['literature in english', 'literature'],
    weightWords: [
      'poem', 'poet', 'stanza', 'drama', 'playwright', 'prose', 'protagonist', 'antagonist', 'metaphor',
      'simile', 'irony', 'soliloquy', 'personification', 'theme', 'rhyme scheme', 'literary device'
    ]
  },
  'Commerce': {
    titleTriggers: ['commerce'],
    weightWords: [
      'trade', 'wholesaler', 'retailer', 'warehousing', 'marine insurance', 'banking', 'transport',
      'advertising', 'stock exchange', 'bill of exchange', 'chamber of commerce', 'export', 'import'
    ]
  },
  'Principles of Accounts': {
    titleTriggers: ['principles of accounts', 'financial accounting', 'accounting'],
    weightWords: [
      'balance sheet', 'ledger', 'debit', 'credit', 'journal', 'trial balance', 'depreciation',
      'profit and loss', 'accrual', 'prepayment', 'bank reconciliation', 'cash book', 'bad debt'
    ]
  },
  'Agricultural Science': {
    titleTriggers: ['agricultural science', 'agric'],
    weightWords: [
      'crop', 'soil', 'fertilizer', 'tillage', 'livestock', 'ruminant', 'poultry', 'irrigation',
      'pest', 'weed', 'pasture', 'forestry', 'horticulture', 'agronomy', 'animal husbandry'
    ]
  },
  'Geography': {
    titleTriggers: ['geography', 'geo'],
    weightWords: [
      'latitude', 'longitude', 'contour', 'topography', 'climate', 'vegetation', 'drainage',
      'erosion', 'rock', 'settlement', 'weathering', 'scale', 'grid reference', 'river basin'
    ]
  },
  'Christian Religious Studies': {
    titleTriggers: ['christian religious studies', 'crs', 'crk'],
    weightWords: ['covenant', 'israel', 'apostle', 'jesus', 'paul', 'prophet', 'gospel', 'resurrection', 'salvation', 'moses', 'david']
  },
  'Islamic Studies': {
    titleTriggers: ['islamic studies', 'irs', 'irk'],
    weightWords: ['allah', 'prophet', 'muhammad', 'quran', 'hadith', 'surah', 'zakat', 'hajj', 'ramadan', 'salat', 'tawhid']
  }
};

/**
 * Intelligent detector that identifies which of the 20 official JAMB subjects a document or question belongs to
 */
export function detectJambSubjectFromContent(text: string, fileName = ''): { subject: string; confidence: number; isChemistry: boolean } {
  const lowerText = (text + ' ' + fileName).toLowerCase();
  
  let bestSubject = 'Chemistry'; // Sensible science/visual default
  let highestScore = 0;
  const totalKeywordsFound: Record<string, number> = {};

  for (const [subName, def] of Object.entries(JAMB_SUBJECT_KEYWORDS)) {
    let score = 0;

    // 1. Explicit title or header match gives large boost
    for (const trig of def.titleTriggers) {
      const regex = new RegExp(`(?:\\b|subject\\s*:\\s*|jamb\\s+|utme\\s+)${trig}\\b`, 'i');
      if (regex.test(lowerText)) {
        score += 80;
      } else if (lowerText.includes(trig)) {
        score += 25;
      }
    }

    // 2. Count technical domain vocabulary
    for (const kw of def.weightWords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lowerText.match(kwRegex);
      if (matches) {
        score += matches.length * 3;
      }
    }

    totalKeywordsFound[subName] = score;
    if (score > highestScore) {
      highestScore = score;
      bestSubject = subName;
    }
  }

  // Calculate percentage confidence (capped between 40% and 99%)
  const confidence = Math.min(99, Math.max(50, Math.round((highestScore / 100) * 85) + 15));
  const isChemistry = bestSubject.toLowerCase() === 'chemistry';

  return {
    subject: bestSubject,
    confidence: highestScore > 0 ? confidence : 65,
    isChemistry
  };
}

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
  let fullAccumulatedText = '';

  onProgress?.(`Loaded PDF with ${numPages} pages. Processing and auto-detecting subject...`, 10);

  // Process each page: Extract text items and render visual page snapshots for diagrams
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(`Analyzing page ${pageNum} of ${numPages} & isolating visual diagrams...`, 10 + Math.round((pageNum / numPages) * 70));
    
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
    fullAccumulatedText += ' ' + fullPageText;

    // Render page to canvas to isolate visual diagrams
    let pageDiagramDataUrl = '';
    try {
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageDiagramDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        extractedDiagrams.push({
          pageNumber: pageNum,
          dataUrl: pageDiagramDataUrl,
          label: `Page ${pageNum} Visual Diagram Snapshot`
        });
      }
    } catch (renderErr) {
      console.warn(`[PdfVisualExtractor] Canvas render notice for page ${pageNum}:`, renderErr);
    }

    // Parse question blocks from page text
    const pageQuestions = parseQuestionsFromText(fullPageText, pageNum, pageDiagramDataUrl);
    allExtractedQuestions.push(...pageQuestions);
  }

  onProgress?.('Classifying official JAMB subject & linking diagrams...', 92);

  // Auto-detect overall subject from accumulated document content
  const detectionResult = detectJambSubjectFromContent(fullAccumulatedText, file.name);
  const resolvedSubject = (subjectHint && subjectHint !== 'General' && subjectHint !== 'Physics')
    ? subjectHint
    : detectionResult.subject;

  // Tag questions with detected subject
  allExtractedQuestions.forEach(q => {
    if (!q.subject) {
      // Also test individual question for mixed PDFs
      const qDetect = detectJambSubjectFromContent(q.questionText);
      q.subject = qDetect.confidence > 75 ? qDetect.subject : resolvedSubject;
    }
  });

  const questionsWithDiagrams = allExtractedQuestions.filter(q => Boolean(q.diagramImageUrl)).length;

  return {
    fileName: file.name,
    numPages,
    totalQuestions: allExtractedQuestions.length,
    questionsWithDiagrams,
    detectedSubject: resolvedSubject,
    detectedSubjectConfidence: detectionResult.confidence,
    isChemistry: resolvedSubject.toLowerCase() === 'chemistry',
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
  // Regex to detect 4 inline options on a single or dual line: "A. xxx B. yyy C. zzz D. www"
  const inlineOptionsRegex = /[\(\[]?A[\)\]\.\:]\s*(.+?)\s+[\(\[]?B[\)\]\.\:]\s*(.+?)\s+[\(\[]?C[\)\]\.\:]\s*(.+?)\s+[\(\[]?D[\)\]\.\:]\s*(.+)/i;
  // Regex to detect 2 inline options: "A. xxx B. yyy"
  const inlineABRegex = /[\(\[]?A[\)\]\.\:]\s*(.+?)\s+[\(\[]?B[\)\]\.\:]\s*(.+)/i;
  // Regex to detect 2 inline options: "C. xxx D. yyy"
  const inlineCDRegex = /[\(\[]?C[\)\]\.\:]\s*(.+?)\s+[\(\[]?D[\)\]\.\:]\s*(.+)/i;
  // Regex to detect correct answer like: "Answer: A" or "Ans: B" or "[Ans: C]"
  const answerRegex = /(?:Answer|Ans|Correct)\s*[:=\-]?\s*[\(\[]?([A-D])[\)\]]?/i;
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

    // Check for 4 inline options on one line: A. xx B. yy C. zz D. ww
    const fourOptsMatch = line.match(inlineOptionsRegex);
    if (fourOptsMatch && currentQ) {
      currentOptions = [
        fourOptsMatch[1].trim(),
        fourOptsMatch[2].trim(),
        fourOptsMatch[3].trim(),
        fourOptsMatch[4].trim()
      ];
      continue;
    }

    // Check for pair inline options: A. xx B. yy
    const abMatch = line.match(inlineABRegex);
    if (abMatch && currentQ && currentOptions.length === 0) {
      currentOptions.push(abMatch[1].trim(), abMatch[2].trim());
      continue;
    }

    // Check for pair inline options: C. xx D. yy
    const cdMatch = line.match(inlineCDRegex);
    if (cdMatch && currentQ && currentOptions.length === 2) {
      currentOptions.push(cdMatch[1].trim(), cdMatch[2].trim());
      continue;
    }

    const qMatch = line.match(questionStartRegex);
    if (qMatch && !line.match(optionRegex) && !line.match(inlineOptionsRegex)) {
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
