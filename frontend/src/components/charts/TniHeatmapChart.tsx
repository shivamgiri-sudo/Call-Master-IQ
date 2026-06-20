import { fmtDec } from '../../utils/formatters';

export interface TniCell {
  rowLabel: string;     // analyst or process
  columnLabel: string;   // parameter / category
  value: number;         // normalized 0..1
  rawValue?: number | string;
}

interface TniHeatmapChartProps {
  cells: TniCell[];
  rowTitle: string;
  columnTitle: string;
  onCellClick?: (cell: TniCell) => void;
}

function heatColor(v: number): string {
  // v in [0, 1]; 0 = worst (red), 1 = best (green)
  const clamped = Math.max(0, Math.min(1, v));
  if (clamped < 0.5) {
    // red -> amber
    const t = clamped * 2;
    return `rgba(248, 113, 113, ${0.18 + 0.55 * t})`;
  }
  if (clamped < 0.85) {
    const t = (clamped - 0.5) / 0.35;
    return `rgba(251, 191, 36, ${0.55 + 0.20 * t})`;
  }
  const t = (clamped - 0.85) / 0.15;
  return `rgba(52, 211, 153, ${0.65 + 0.25 * t})`;
}

export default function TniHeatmapChart({ cells, rowTitle, columnTitle, onCellClick }: TniHeatmapChartProps) {
  const rows = Array.from(new Set(cells.map(c => c.rowLabel)));
  const cols = Array.from(new Set(cells.map(c => c.columnLabel)));

  if (rows.length === 0 || cols.length === 0) return null;

  const cellMap = new Map<string, TniCell>();
  for (const c of cells) cellMap.set(`${c.rowLabel}::${c.columnLabel}`, c);

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-base/85 px-3 py-2 text-left text-[11px] uppercase tracking-wider text-ink-muted backdrop-blur">
              {rowTitle}
            </th>
            {cols.map(c => (
              <th key={c} className="px-2 py-2 text-left text-[11px] uppercase tracking-wider text-ink-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              <th className="sticky left-0 z-10 bg-base/85 px-3 py-2 text-left text-xs font-medium text-ink-secondary backdrop-blur">
                {r}
              </th>
              {cols.map(c => {
                const cell = cellMap.get(`${r}::${c}`);
                if (!cell) return <td key={c} className="rounded-md bg-elevated/30 px-2 py-3 text-center text-xs text-ink-muted">—</td>;
                return (
                  <td
                    key={c}
                    onClick={() => onCellClick?.(cell)}
                    className="cursor-pointer rounded-md px-2 py-3 text-center text-xs font-medium text-ink-primary transition-transform hover:scale-[1.04]"
                    style={{ backgroundColor: heatColor(cell.value) }}
                    title={cell.rawValue !== undefined ? `${r} · ${c} · ${fmtDec(cell.rawValue, 1)}` : undefined}
                  >
                    {cell.rawValue !== undefined ? fmtDec(cell.rawValue, 1) : fmtDec(cell.value, 2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}