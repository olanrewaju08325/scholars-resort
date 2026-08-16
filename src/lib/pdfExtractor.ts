import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker safely
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
} catch (e) {
  console.warn('Could not set workerSrc for pdfjs:', e);
}

/**
 * Extract clean textual content from an uploaded File (PDF, TXT, CSV, MD, JSON)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

  if (fileExt === 'pdf' || file.type === 'application/pdf') {
    let extractedPdfText = '';

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Disable worker if worker fails, or use inline worker loading
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .filter((str: string) => str.trim().length > 0)
          .join(' ');
        if (pageText.trim()) {
          extractedPdfText += `\n--- Page ${i} ---\n${pageText}`;
        }
      }
    } catch (pdfErr) {
      console.warn('PDF.js primary extraction failed, attempting fallback stream parsing:', pdfErr);
    }

    if (extractedPdfText.trim().length > 20) {
      return extractedPdfText.trim();
    }

    // Secondary fallback: Try extracting plain text stream safely without binary garbage
    try {
      const rawText = await file.text();
      // Strip binary headers (%PDF) and keep readable printable text
      if (rawText.includes('%PDF')) {
        // Extract text streams between BT (Begin Text) and ET (End Text) or printable ASCII strings
        const textMatches = rawText.match(/\(([^()]+)\)/g);
        if (textMatches && textMatches.length > 5) {
          const cleanText = textMatches
            .map(m => m.slice(1, -1))
            .filter(str => /[a-zA-Z0-9]{3,}/.test(str))
            .join(' ');
          if (cleanText.length > 50) {
            return cleanText;
          }
        }
        throw new Error('This PDF appears to be a scanned image or binary formatted file. Please copy & paste text directly into Direct Text Ingestion.');
      }
      return rawText;
    } catch (err: any) {
      throw new Error(err.message || 'Could not extract text from PDF file. Please paste text directly into Direct Text Ingestion.');
    }
  }

  // Standard plain text file reading for .txt, .md, .csv, .json
  const textContent = await file.text();
  if (textContent.startsWith('%PDF')) {
    throw new Error('This file contains binary PDF data. Please use a plain text file or copy-paste text directly.');
  }
  return textContent;
}

