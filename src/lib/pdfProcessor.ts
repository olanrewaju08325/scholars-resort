import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

/**
 * Splits a large PDF into smaller PDF Blobs, each containing a set number of pages.
 * Useful for incremental image extraction.
 */
export async function splitPdfIntoChunks(
  file: File,
  chunkSize: number = 5
): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = (window as any).pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const chunks: Blob[] = [];

  for (let i = 0; i < numPages; i += chunkSize) {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'pt',
      format: 'a4'
    });

    for (let j = i; j < i + chunkSize && j < numPages; j++) {
      const pageNum = j + 1;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        
        if (j > i) doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
      }
    }
    chunks.push(doc.output('blob'));
  }

  return chunks;
}
