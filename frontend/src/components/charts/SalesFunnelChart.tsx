import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { CHART_PALETTE } from '../../utils/colors';
import { fmtInt } from '../../utils/formatters';
import type { SalesFunnelStage } from '../../api/types';

interface SalesFunnelChartProps {
  stages: SalesFunnelStage[];
  onStageClick?: (stage: SalesFunnelStage) => void;
}

const STAGE_COLORS = [
  CHART_PALETTE.violet,
  CHART_PALETTE.blue,
  CHART_PALETTE.cyan,
  CHART_PALETTE.good,
  CHART_PALETTE.warn,
];

export default function SalesFunnelChart({ stages, onStageClick }: SalesFunnelChartProps) {
  const data = useMemo(
    () => stages.map(s => ({ stage: s.stage, count: s.count, conversionRateFromPrevious: s.conversionRateFromPrevious })),
    [stages],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, bottom: 8, left: 24 }}
        onClick={(e: any) => {
          if (onStageClick && e?.activePayload?.[0]?.payload) {
            onStageClick(e.activePayload[0].payload as SalesFunnelStage);
          }
        }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} width={180} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{ backgroundColor: 'rgba(11,16,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
          formatter={(value: any, _name: any, ctx: any) => {
            const rate = ctx?.payload?.conversionRateFromPrevious;
            const rateStr = rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`;
            return [`${fmtInt(value)}  ·  conversion ${rateStr}`, 'Count'];
          }}
        />
        <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}