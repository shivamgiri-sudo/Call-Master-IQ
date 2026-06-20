import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { CHART_PALETTE } from '../../utils/colors';
import { fmtInt } from '../../utils/formatters';
import type { RiskByProcessRow } from '../../api/types';

interface RiskByProcessChartProps {
  rows: RiskByProcessRow[];
  dimension: 'category' | 'process_name';
  onProcessClick?: (row: RiskByProcessRow) => void;
}

export default function RiskByProcessChart({ rows, dimension, onProcessClick }: RiskByProcessChartProps) {
  const data = rows.slice(0, 12).map(r => ({
    process: r.process,
    criticalCalls: r.criticalCalls,
    highRiskCalls: r.highRiskCalls,
    mediumRiskCalls: r.mediumRiskCalls,
    safeCalls: r.safeCalls,
    _row: r,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 4, right: 12, bottom: 24, left: -8 }}
        onClick={(e: any) => {
          if (onProcessClick && e?.activePayload?.[0]?.payload?._row) {
            onProcessClick(e.activePayload[0].payload._row as RiskByProcessRow);
          }
        }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="process" tickLine={false} axisLine={false} angle={-12} textAnchor="end" interval={0} height={56} />
        <YAxis tickLine={false} axisLine={false} width={36} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{ backgroundColor: 'rgba(11,16,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
          formatter={(v: any) => fmtInt(v)}
          labelFormatter={(label: any) => `${label}  (grouped by ${dimension})`}
        />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: 4 }} />
        <Bar dataKey="criticalCalls"  name="Critical" stackId="a" fill={CHART_PALETTE.bad}    radius={[0, 0, 0, 0]} />
        <Bar dataKey="highRiskCalls"  name="High"     stackId="a" fill={CHART_PALETTE.warn}   radius={[0, 0, 0, 0]} />
        <Bar dataKey="mediumRiskCalls" name="Medium"  stackId="a" fill={CHART_PALETTE.cyan}   radius={[0, 0, 0, 0]} />
        <Bar dataKey="safeCalls"      name="Safe"     stackId="a" fill={CHART_PALETTE.good}   radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}