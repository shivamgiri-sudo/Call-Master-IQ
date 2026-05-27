"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePdf = generatePdf;
const pdf_lib_1 = require("pdf-lib");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
async function generatePdf(title, sections, outputDir, filename) {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage(pdf_lib_1.PageSizes.A4);
    const { width, height } = page.getSize();
    const margin = 60;
    let y = height - margin;
    const addText = (text, size, useBold = false, color = (0, pdf_lib_1.rgb)(0.1, 0.1, 0.1)) => {
        const usedFont = useBold ? boldFont : font;
        const words = text.split(' ');
        let line = '';
        const maxWidth = width - margin * 2;
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            const testWidth = usedFont.widthOfTextAtSize(test, size);
            if (testWidth > maxWidth && line) {
                if (y < margin + 20) {
                    page = pdfDoc.addPage(pdf_lib_1.PageSizes.A4);
                    y = height - margin;
                }
                page.drawText(line, { x: margin, y, size, font: usedFont, color });
                y -= size + 4;
                line = word;
            }
            else {
                line = test;
            }
        }
        if (line) {
            if (y < margin + 20) {
                page = pdfDoc.addPage(pdf_lib_1.PageSizes.A4);
                y = height - margin;
            }
            page.drawText(line, { x: margin, y, size, font: usedFont, color });
            y -= size + 4;
        }
    };
    addText(title, 22, true, (0, pdf_lib_1.rgb)(0.15, 0.3, 0.6));
    y -= 16;
    for (const section of sections) {
        y -= 12;
        addText(section.heading, 14, true, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.6));
        y -= 4;
        for (const para of section.paragraphs) {
            addText(para, 11);
            y -= 6;
        }
    }
    const bytes = await pdfDoc.save();
    const filePath = path_1.default.join(outputDir, filename);
    fs_1.default.writeFileSync(filePath, bytes);
    return filePath;
}
