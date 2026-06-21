type CsvRow = Record<string, string | number | boolean | null | undefined>;

const BLOCKED_FIELD_PATTERN = /(password|token|secret|authorization|bearer|transcript|raw|jwt)/i;

export function copySafeText(text: string): void {
  if (!text.trim()) return;
  void navigator.clipboard.writeText(text);
}

export function toCsv(rows: CsvRow[], columns: Array<{ key: string; label: string }>): string {
  const safeColumns = columns.filter(col => !BLOCKED_FIELD_PATTERN.test(col.key) && !BLOCKED_FIELD_PATTERN.test(col.label));
  const header = safeColumns.map(col => escapeCsv(col.label)).join(',');
  const body = rows.map(row => safeColumns.map(col => escapeCsv(row[col.key])).join(',')).join('\n');
  return [header, body].filter(Boolean).join('\n');
}

export function downloadCsv(filename: string, csv: string): void {
  if (!csv.trim()) return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}
