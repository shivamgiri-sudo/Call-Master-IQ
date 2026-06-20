import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { CHART_PALETTE } from '../../utils/colors';
import { fmtInt } from '../../utils/formatters';
import type { SensitiveWordTerm } from '../../api/types';

interface SensitiveWordsChartProps {
  terms: SensitiveWordTerm[];
  onTermClick?: (term: SensitiveWordTerm) => void;
}

export default function SensitiveWordsChart({ terms, onTermClick }: SensitiveWordsChartProps) {
  const data = terms.slice(0, 20).map(t => ({ term: t.term, count: t.count }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 8, left: 24 }}
        onClick={(e: any) => {
          if (onTermClick && e?.activePayload?.[0]?.payload) {
            onTermClick(e.activePayload[0].payload as SensitiveWordTerm);
          }
        }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="term" tickLine={false} axisLine={false} width={160} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{ backgroundColor: 'rgba(11,16,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
          formatter={(v: any) => fmtInt(v)}
        />
        <Bar dataKey="count" fill={CHART_PALETTE.warn} radius={[0, 8, 8, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}