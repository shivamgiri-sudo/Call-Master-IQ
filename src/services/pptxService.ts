import PptxGenJS from 'pptxgenjs';
import path from 'path';
import fs from 'fs';

export interface SlideContent {
  title: string;
  bullets: string[];
}

export async function generatePptx(slides: SlideContent[], outputDir: string, filename: string): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  for (const slide of slides) {
    const s = pptx.addSlide();

    s.addText(slide.title, {
      x: 0.5, y: 0.3, w: '90%', h: 1.0,
      fontSize: 28, bold: true, color: '363636',
    });

    const bulletText = slide.bullets.map(b => ({ text: b, options: { bullet: true } }));
    s.addText(bulletText, {
      x: 0.5, y: 1.5, w: '90%', h: 4.5,
      fontSize: 16, color: '444444', valign: 'top',
    });
  }

  const filePath = path.join(outputDir, filename);
  await pptx.writeFile({ fileName: filePath });
  return filePath;
}
