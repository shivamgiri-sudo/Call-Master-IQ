import ExcelJS from 'exceljs';
import path from 'path';

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
}

export async function generateXlsx(sheets: SheetData[], outputDir: string, filename: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();

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

  const filePath = path.join(outputDir, filename);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}
