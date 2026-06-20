import { Inbox } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({
  title = 'No records found',
  description = 'There is no data for the selected filters and time window.',
  action,
}: EmptyStateProps) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line-subtle bg-elevated/40 text-ink-muted">
        <Inbox size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-primary">{title}</p>
        <p className="text-xs leading-relaxed text-ink-muted">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}