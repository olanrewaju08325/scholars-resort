import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker for pdfjs in Vite/browser environment
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
} catch (e) {
  console.warn('Could not set workerSrc for pdfjs:', e);
}

/**
 * Extract clean textual content from an uploaded File (PDF, TXT, CSV, MD, JSON)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

  if (fileExt === 'pdf' || file.type === 'application/pdf') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ');
        fullText += `\n--- Page ${i} ---\n` + pageText;
      }

      if (fullText.trim().length > 0) {
        return fullText.trim();
      }
    } catch (pdfErr) {
      console.warn('PDF.js binary extraction failed, falling back to text stream:', pdfErr);
    }
  }

  // Standard fallback for .txt, .md, .csv, .json or text-encoded PDFs
  return await file.text();
}
