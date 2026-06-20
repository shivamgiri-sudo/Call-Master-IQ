import { ReactNode } from 'react';
import LoadingSkeleton from '../states/LoadingSkeleton';
import EmptyState from '../states/EmptyState';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children?: ReactNode;
  className?: string;
  height?: number;
}

/** Wrapper providing consistent padding / title / chart slot. */
export default function ChartCard({
  title,
  subtitle,
  actions,
  loading,
  empty,
  emptyMessage,
  children,
  className = '',
  height = 280,
}: ChartCardProps) {
  return (
    <section className={`glass flex flex-col p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight text-ink-primary">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>

      {loading ? (
        <LoadingSkeleton variant="chart" />
      ) : empty ? (
        <EmptyState title="No data" description={emptyMessage ?? 'No records in the selected window.'} />
      ) : (
        <div style={{ height }} className="min-h-0 w-full">
          {children}
        </div>
      )}
    </section>
  );
}