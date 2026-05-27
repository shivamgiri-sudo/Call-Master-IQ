import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

export interface PdfSection {
  heading: string;
  paragraphs: string[];
}

export async function generatePdf(title: string, sections: PdfSection[], outputDir: string, filename: string): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const margin = 60;
  let y = height - margin;

  const addText = (text: string, size: number, useBold = false, color = rgb(0.1, 0.1, 0.1)) => {
    const usedFont = useBold ? boldFont : font;
    const words = text.split(' ');
    let line = '';
    const maxWidth = width - margin * 2;

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const testWidth = usedFont.widthOfTextAtSize(test, size);
      if (testWidth > maxWidth && line) {
        if (y < margin + 20) {
          page = pdfDoc.addPage(PageSizes.A4);
          y = height - margin;
        }
        page.drawText(line, { x: margin, y, size, font: usedFont, color });
        y -= size + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < margin + 20) {
        page = pdfDoc.addPage(PageSizes.A4);
        y = height - margin;
      }
      page.drawText(line, { x: margin, y, size, font: usedFont, color });
      y -= size + 4;
    }
  };

  addText(title, 22, true, rgb(0.15, 0.3, 0.6));
  y -= 16;

  for (const section of sections) {
    y -= 12;
    addText(section.heading, 14, true, rgb(0.2, 0.2, 0.6));
    y -= 4;
    for (const para of section.paragraphs) {
      addText(para, 11);
      y -= 6;
    }
  }

  const bytes = await pdfDoc.save();
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}
