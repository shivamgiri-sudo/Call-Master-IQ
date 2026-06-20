import { ReactNode } from 'react';

interface InsightCardProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
  icon?: ReactNode;
  onClick?: () => void;
}

const TONE_BORDER: Record<NonNullable<InsightCardProps['tone']>, string> = {
  neutral: 'border-line-subtle',
  good: 'border-good/30',
  warn: 'border-warn/30',
  bad: 'border-bad/30',
  info: 'border-blue/30',
};

const TONE_ICON: Record<NonNullable<InsightCardProps['tone']>, string> = {
  neutral: 'text-ink-secondary',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-blue',
};

export default function InsightCard({
  title,
  description,
  meta,
  tone = 'neutral',
  icon,
  onClick,
}: InsightCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={[
        'glass card-hover relative w-full overflow-hidden p-4 text-left focus-ring',
        TONE_BORDER[tone],
        onClick ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-subtle bg-elevated/40 ${TONE_ICON[tone]}`}>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug text-ink-primary">{title}</p>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>
          ) : null}
          {meta ? <div className="mt-2 text-[11px] uppercase tracking-wider text-ink-muted">{meta}</div> : null}
        </div>
      </div>
    </Wrapper>
  );
}