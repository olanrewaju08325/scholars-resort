import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker safely
try {
  if (typeof window !== 'undefined' && 'Worker' in window) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
} catch (e) {
  console.warn('Could not set workerSrc for pdfjs:', e);
}

export interface DocumentExtractionResult {
  isScanned: boolean;
  isImage: boolean;
  pageImages: string[]; // Base64 data URLs for scanned PDF pages or uploaded images
  extractedText: string;
  numPages: number;
  fileName: string;
}

/**
 * Advanced Document Extraction: Handles Text PDFs, Scanned PDFs (via canvas rendering),
 * Image files (PNG, JPG, WEBP), and plain text documents.
 */
export async function extractDocumentWithOcrOrText(file: File): Promise<DocumentExtractionResult> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const isImageFile = ['png', 'jpg', 'jpeg', 'webp'].includes(fileExt) || file.type.startsWith('image/');

  // 1. Image File Handling (Photos/Scans of questions)
  if (isImageFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({
          isScanned: true,
          isImage: true,
          pageImages: [dataUrl],
          extractedText: '',
          numPages: 1,
          fileName: file.name
        });
      };
      reader.onerror = (err) => reject(new Error('Failed to read image file: ' + err));
      reader.readAsDataURL(file);
    });
  }

  // 2. PDF Handling (Distinguishes between Text PDFs and Scanned Image PDFs)
  if (fileExt === 'pdf' || file.type === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      let totalTextCharCount = 0;
      let fullText = '';
      const textPerPage: string[] = [];

      // Pass 1: Text Stream Inspection
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStr = textContent.items
          .map((item: any) => item.str || '')
          .filter((str: string) => str.trim().length > 0)
          .join(' ');
        
        textPerPage.push(pageStr);
        totalTextCharCount += pageStr.trim().length;
        if (pageStr.trim()) {
          fullText += `\n--- Page ${i} ---\n${pageStr}`;
        }
      }

      const avgCharsPerPage = totalTextCharCount / (numPages || 1);

      // If text stream exists and has sufficient text density (> 30 chars per page), it's a Text PDF
      if (avgCharsPerPage >= 30) {
        return {
          isScanned: false,
          isImage: false,
          pageImages: [],
          extractedText: fullText.trim(),
          numPages,
          fileName: file.name
        };
      }

      // If text density is low or 0, it's a SCANNED PDF. Render pages to offscreen canvas images!
      const pageImages: string[] = [];
      const maxPagesToRender = Math.min(numPages, 10); // Cap at 10 pages per batch for optimal performance

      for (let i = 1; i <= maxPagesToRender; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // High resolution for clear OCR
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          pageImages.push(dataUrl);
        }
      }

      return {
        isScanned: true,
        isImage: false,
        pageImages,
        extractedText: fullText.trim(), // Include any fragment text if available
        numPages,
        fileName: file.name
      };

    } catch (pdfErr) {
      console.warn('PDF.js parsing warning, falling back to text stream reader:', pdfErr);
    }
  }

  // 3. Fallback for Plain Text, CSV, TXT, JSON, MD
  const textContent = await file.text();
  return {
    isScanned: false,
    isImage: false,
    pageImages: [],
    extractedText: textContent,
    numPages: 1,
    fileName: file.name
  };
}

/**
 * Legacy wrapper function for text extraction backward compatibility
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const result = await extractDocumentWithOcrOrText(file);
  return result.extractedText || 'Scanned Document Image';
}


