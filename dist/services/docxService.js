"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDocx = generateDocx;
const docx_1 = require("docx");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
async function generateDocx(title, sections, outputDir, filename) {
    const children = [];
    children.push(new docx_1.Paragraph({
        text: title,
        heading: docx_1.HeadingLevel.TITLE,
        alignment: docx_1.AlignmentType.CENTER,
        spacing: { after: 400 },
    }));
    for (const section of sections) {
        children.push(new docx_1.Paragraph({
            text: section.heading,
            heading: docx_1.HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
        }));
        for (const para of section.paragraphs) {
            children.push(new docx_1.Paragraph({
                children: [new docx_1.TextRun({ text: para, size: 24 })],
                spacing: { after: 200 },
            }));
        }
    }
    const doc = new docx_1.Document({ sections: [{ children }] });
    const buffer = await docx_1.Packer.toBuffer(doc);
    const filePath = path_1.default.join(outputDir, filename);
    fs_1.default.writeFileSync(filePath, buffer);
    return filePath;
}
