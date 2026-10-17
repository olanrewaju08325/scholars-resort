import { pdfjsLib } from '@/lib/pdfWorkerSetup';

export interface GridElement {
  type: 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string | null;
}

export interface GridBlock {
  elements: GridElement[];
  y: number;
  height: number;
}

export class PdfGridEngine {
  /**
   * Maps page elements to a normalized 2D coordinate grid (X, Y).
   */
  static async mapToGrid(page: any): Promise<GridElement[]> {
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    const elements: GridElement[] = textContent.items.map((item: any) => {
      const transform = item.transform;
      // PDF.js coordinates are bottom-left, convert to top-left
      const x = transform[4];
      const y = viewport.height - transform[5];
      const width = item.width;
      const height = item.height;

      return {
        type: 'text',
        x,
        y,
        width,
        height,
        content: item.str
      };
    });

    return elements;
  }

  /**
   * Groups elements into logical blocks based on vertical and horizontal proximity.
   */
  static clusterElements(elements: GridElement[], yTolerance: number = 5): GridBlock[] {
    if (elements.length === 0) return [];

    // Sort by Y-coordinate (top-to-bottom)
    const sorted = [...elements].sort((a, b) => a.y - b.y);
    const blocks: GridBlock[] = [];

    for (const el of sorted) {
      let added = false;
      for (const block of blocks) {
        // If element is vertically close to the block, add it
        if (Math.abs(block.y - el.y) <= yTolerance) {
          block.elements.push(el);
          block.height = Math.max(block.height, el.y + el.height - block.y);
          added = true;
          break;
        }
      }
      if (!added) {
        blocks.push({
          elements: [el],
          y: el.y,
          height: el.height
        });
      }
    }

    // Sort elements within each block by X-coordinate (left-to-right)
    for (const block of blocks) {
      block.elements.sort((a, b) => a.x - b.x);
    }

    return blocks;
  }
}
