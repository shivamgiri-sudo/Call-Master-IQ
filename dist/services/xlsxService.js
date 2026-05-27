"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateXlsx = generateXlsx;
const exceljs_1 = __importDefault(require("exceljs"));
const path_1 = __importDefault(require("path"));
async function generateXlsx(sheets, outputDir, filename) {
    const workbook = new exceljs_1.default.Workbook();
    for (const sheet of sheets) {
        const ws = workbook.addWorksheet(sheet.sheetName);
        ws.addRow(sheet.headers);
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        for (const row of sheet.rows) {
            ws.addRow(row);
        }
        ws.columns.forEach(col => {
            col.width = 20;
        });
    }
    const filePath = path_1.default.join(outputDir, filename);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}
