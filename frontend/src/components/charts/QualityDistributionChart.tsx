import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { CHART_PALETTE } from '../../utils/colors';
import { fmtInt } from '../../utils/formatters';
import type { CountItem } from '../../api/types';

const BAND_COLORS: Record<string, string> = {
  Excellent: CHART_PALETTE.good,
  Good: CHART_PALETTE.blue,
  'Improvement Required': CHART_PALETTE.warn,
  'High Risk': CHART_PALETTE.bad,
  'Critical Coaching': CHART_PALETTE.bad,
  'Non-Assessable': CHART_PALETTE.muted,
  'Limited Evidence': CHART_PALETTE.muted,
};

interface QualityDistributionChartProps {
  bands: CountItem[];
  onBandClick?: (band: CountItem) => void;
}

export default function QualityDistributionChart({ bands, onBandClick }: QualityDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={bands}
          dataKey="count"
          nameKey="label"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          stroke="rgba(0,0,0,0.4)"
          onClick={(d: any) => onBandClick?.(d as CountItem)}
        >
          {bands.map(b => (
            <Cell key={b.label} fill={BAND_COLORS[b.label] ?? CHART_PALETTE.violet} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: 'rgba(11,16,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
          formatter={(v: any) => fmtInt(v)}
        />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}