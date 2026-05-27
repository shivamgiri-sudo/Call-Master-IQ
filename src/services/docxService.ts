import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType
} from 'docx';
import path from 'path';
import fs from 'fs';

export interface DocSection {
  heading: string;
  paragraphs: string[];
}

export async function generateDocx(title: string, sections: DocSection[], outputDir: string, filename: string): Promise<string> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  for (const section of sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const para of section.paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para, size: 24 })],
          spacing: { after: 200 },
        })
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
