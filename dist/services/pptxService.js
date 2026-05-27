"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePptx = generatePptx;
const pptxgenjs_1 = __importDefault(require("pptxgenjs"));
const path_1 = __importDefault(require("path"));
async function generatePptx(slides, outputDir, filename) {
    const pptx = new pptxgenjs_1.default();
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
    const filePath = path_1.default.join(outputDir, filename);
    await pptx.writeFile({ fileName: filePath });
    return filePath;
}
