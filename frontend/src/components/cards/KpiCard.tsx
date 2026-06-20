import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import LoadingSkeleton from '../states/LoadingSkeleton';

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string } | null;
  loading?: boolean;
  onClick?: () => void;
}

const TONE_RING: Record<Tone, string> = {
  neutral: 'border-line-default',
  good: 'border-good/30',
  warn: 'border-warn/30',
  bad: 'border-bad/30',
  info: 'border-blue/30',
};

const TONE_VALUE: Record<Tone, string> = {
  neutral: 'text-ink-primary',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-blue',
};

export default function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  trend,
  loading = false,
  onClick,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="glass p-5">
        <LoadingSkeleton variant="kpi" />
      </div>
    );
  }

  const interactive = Boolean(onClick);
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={[
        'glass card-hover relative w-full overflow-hidden p-5 text-left focus-ring',
        TONE_RING[tone],
        interactive ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
          <div className={`mt-2 text-3xl font-semibold leading-none ${TONE_VALUE[tone]}`}>
            {value}
          </div>
        </div>
        {icon ? (
          <div
            className={`grid h-9 w-9 place-items-center rounded-xl border ${
              tone === 'good' ? 'border-good/30 bg-good/10 text-good' :
              tone === 'warn' ? 'border-warn/30 bg-warn/10 text-warn' :
              tone === 'bad' ? 'border-bad/30 bg-bad/10 text-bad' :
              tone === 'info' ? 'border-blue/30 bg-blue/10 text-blue' :
              'border-line-subtle bg-elevated/40 text-ink-secondary'
            }`}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {hint || trend ? (
        <div className="mt-3 flex items-center justify-between text-xs">
          {hint ? <span className="text-ink-muted">{hint}</span> : <span />}
          {trend && trend.direction !== 'flat' ? (
            <span
              className={`inline-flex items-center gap-1 ${
                trend.direction === 'up' ? 'text-good' : 'text-bad'
              }`}
            >
              {trend.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.label}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Subtle inner highlight on top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </Wrapper>
  );
}