import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

try {
  if (typeof window !== 'undefined') {
    (window as any).pdfjsLib = pdfjsLib;
    if (pdfWorkerUrl) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    } else {
      // Fallback to a verified stable cdnjs version of pdf.worker.min.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }
} catch (e) {
  console.warn('[PDFWorkerSetup] Failed to initialize workerSrc:', e);
}

export { pdfjsLib };
