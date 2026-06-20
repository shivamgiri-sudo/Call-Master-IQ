import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { CHART_PALETTE } from '../../utils/colors';
import { fmtPct } from '../../utils/formatters';
import type { ParameterTrendSeries } from '../../api/types';

interface ParameterTrendChartProps {
  series: ParameterTrendSeries[];
  onParameterClick?: (p: ParameterTrendSeries) => void;
}

const PALETTE = [
  CHART_PALETTE.violet,
  CHART_PALETTE.blue,
  CHART_PALETTE.cyan,
  CHART_PALETTE.good,
  CHART_PALETTE.warn,
  CHART_PALETTE.bad,
];

export default function ParameterTrendChart({ series, onParameterClick }: ParameterTrendChartProps) {
  // Merge all dates into one axis
  const allDates = Array.from(
    new Set(series.flatMap(s => s.series.map(p => p.date))),
  ).sort();

  const data = allDates.map(date => {
    const row: Record<string, number | string | null> = { date };
    for (const s of series) {
      const point = s.series.find(p => p.date === date);
      row[s.parameter] = point?.passRate ?? null;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 12, bottom: 8, left: -8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={42} tickFormatter={(v: number) => `${Math.round((v || 0) * 100)}%`} />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeDasharray: '3 3' }}
          contentStyle={{ backgroundColor: 'rgba(11,16,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
          formatter={(v: any) => (typeof v === 'number' ? fmtPct(v, 1) : '—')}
        />
        <Legend wrapperStyle={{ paddingTop: 8 }} iconType="circle" onClick={(e: any) => {
          if (onParameterClick && e?.dataKey) {
            const found = series.find(s => s.parameter === e.dataKey);
            if (found) onParameterClick(found);
          }
        }} />
        {series.map((s, i) => (
          <Line
            key={s.parameter}
            type="monotone"
            dataKey={s.parameter}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}