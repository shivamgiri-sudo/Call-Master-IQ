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

export interface TrendSeriesPoint {
  date: string;
  [k: string]: number | string | null | undefined;
}

interface TrendLineChartProps {
  data: TrendSeriesPoint[];
  series: Array<{ key: string; label: string; color?: string }>;
  yLabel?: string;
  onPointClick?: (point: TrendSeriesPoint) => void;
}

export default function TrendLineChart({ data, series, yLabel, onPointClick }: TrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 4, right: 12, bottom: 8, left: -8 }}
        onClick={(e: any) => {
          if (onPointClick && e?.activePayload?.[0]?.payload) {
            onPointClick(e.activePayload[0].payload as TrendSeriesPoint);
          }
        }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={36} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: 'rgba(244,246,251,0.45)', fontSize: 11, dx: 12 } : undefined} />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeDasharray: '3 3' }}
          contentStyle={{ backgroundColor: 'rgba(11,16,24,0.96)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12 }}
          labelStyle={{ color: 'rgba(244,246,251,0.62)' }}
        />
        <Legend wrapperStyle={{ paddingTop: 8 }} iconType="circle" />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? [CHART_PALETTE.violet, CHART_PALETTE.blue, CHART_PALETTE.cyan, CHART_PALETTE.good][i % 4]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: 'currentColor' }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}