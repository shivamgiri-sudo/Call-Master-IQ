import { AlertOctagon, RefreshCw } from 'lucide-react';
import { ReactNode } from 'react';

interface ErrorStateProps {
  status?: number;
  code?: string;
  message?: string;
  onRetry?: () => void;
  /** Optional content rendered below the title (e.g. raw stack for support tickets — never shown by default). */
  detail?: ReactNode;
}

export default function ErrorState({ status, code, message, onRetry, detail }: ErrorStateProps) {
  const isForbidden = status === 403;
  const headline = isForbidden ? 'Unauthorized' : code ? `Error · ${code}` : 'Something went wrong';
  const body = isForbidden
    ? 'Your current role does not include permission for this data or action.'
    : message;
  return (
    <div className="glass flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-bad/30 bg-bad/10 text-bad">
        <AlertOctagon size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink-primary">{headline}</p>
        {body ? (
          <p className="max-w-md text-xs leading-relaxed text-ink-secondary">{body}</p>
        ) : null}
        {typeof status === 'number' ? (
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">HTTP {status}</p>
        ) : null}
        {detail ? <div className="mt-2 text-left text-xs text-ink-muted">{detail}</div> : null}
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-line-default bg-elevated/60 px-4 py-2 text-xs font-medium text-ink-primary transition-colors hover:border-line-strong focus-ring"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      ) : null}
    </div>
  );
}
