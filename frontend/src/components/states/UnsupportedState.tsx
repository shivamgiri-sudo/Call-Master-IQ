import { Info } from 'lucide-react';

interface UnsupportedStateProps {
  reason?: string;
  title?: string;
}

/**
 * Rendered when an endpoint returns `{ success: true, data: { supported: false, reason: '…' } }`.
 * Per the user's brief: do NOT show as an error; do NOT show fake charts.
 */
export default function UnsupportedState({
  reason,
  title = 'Not available for this process',
}: UnsupportedStateProps) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue/30 bg-blue/10 text-blue">
        <Info size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-primary">{title}</p>
        {reason ? (
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">Reason · {reason}</p>
        ) : (
          <p className="text-xs text-ink-muted">
            The selected adapter does not expose the columns this view requires.
          </p>
        )}
      </div>
    </div>
  );
}