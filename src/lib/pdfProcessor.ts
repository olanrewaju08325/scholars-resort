import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { jsPDF } from 'jspdf';

// Ensure PDF.js worker is properly set up in all browser contexts
try {
  if (typeof window !== 'undefined') {
    (window as any).pdfjsLib = pdfjsLib;
    if (pdfWorkerUrl) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    } else {
      const installedVersion = (pdfjsLib as any).version || '6.2.108';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${installedVersion}/build/pdf.worker.min.mjs`;
    }
  }
} catch (e) {
  console.warn('[PDFProcessor] Could not set workerSrc for pdfjs:', e);
}

/**
 * Splits a large PDF into smaller PDF Blobs, each containing a set number of pages (default 5).
 * Uses pdf-lib for non-destructive binary slicing (preserving original text stream, equations,
 * vector diagrams, and layout), with resilient pdfjs fallback if needed.
 *
 * @param file The original PDF file uploaded by the user
 * @param chunkSize Number of pages per segment (default: 5)
 * @param onChunkProgress Optional callback reporting progress for each chunk created
 */
export async function splitPdfIntoChunks(
  file: File,
  chunkSize: number = 5,
  onChunkProgress?: (currentChunk: number, totalChunks: number, status: string) => void
): Promise<Blob[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Primary strategy: pdf-lib binary slice (fast, lossless, preserves text stream and visual diagrams)
    try {
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const numPages = srcDoc.getPageCount();

      if (numPages <= chunkSize) {
        onChunkProgress?.(1, 1, 'PDF fits within 1 processing chunk');
        return [new Blob([arrayBuffer], { type: 'application/pdf' })];
      }

      const totalChunks = Math.ceil(numPages / chunkSize);
      const chunks: Blob[] = [];

      for (let i = 0; i < numPages; i += chunkSize) {
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        onChunkProgress?.(chunkIndex, totalChunks, `Slicing Chunk ${chunkIndex} of ${totalChunks}...`);

        const subDoc = await PDFDocument.create();
        const pageIndices: number[] = [];
        for (let j = i; j < Math.min(i + chunkSize, numPages); j++) {
          pageIndices.push(j);
        }

        const copiedPages = await subDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach((p) => subDoc.addPage(p));

        const subBytes = await subDoc.save();
        chunks.push(new Blob([subBytes], { type: 'application/pdf' }));
      }

      return chunks;
    } catch (pdfLibErr) {
      console.warn('[PDFProcessor] pdf-lib slice fallback to pdfjs-dist:', pdfLibErr);
    }

    // Secondary strategy: pdfjs-dist parsing with canvas render fallback
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    if (numPages <= chunkSize) {
      return [new Blob([arrayBuffer], { type: 'application/pdf' })];
    }

    const totalChunks = Math.ceil(numPages / chunkSize);
    const chunks: Blob[] = [];

    for (let i = 0; i < numPages; i += chunkSize) {
      const chunkIndex = Math.floor(i / chunkSize) + 1;
      onChunkProgress?.(chunkIndex, totalChunks, `Rendering Chunk ${chunkIndex} of ${totalChunks}...`);

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
      });

      for (let j = i; j < Math.min(i + chunkSize, numPages); j++) {
        const pageNum = j + 1;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.2 });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const imgData = canvas.toDataURL('image/jpeg', 0.85);

          if (j > i) doc.addPage();
          doc.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
        }
      }
      chunks.push(doc.output('blob'));
    }

    return chunks;
  } catch (err) {
    console.error('[PDFProcessor] Critical error in splitPdfIntoChunks:', err);
    // Safe graceful degradation: return original file as a single-element array
    return [file];
  }
}
