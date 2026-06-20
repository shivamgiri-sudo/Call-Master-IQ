import { Activity, Database, ShieldCheck, User2 } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FiltersContext';
import { getBaseUrl } from '../api/httpClient';
import { fmtDate } from '../utils/formatters';

export default function SettingsFilters() {
  const { user } = useAuth();
  const { filters } = useFilters();
  const baseUrl = getBaseUrl();

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Settings & Filters"
        subtitle="Configure connection, runtime validation status, and view operator identity."
      />
      <GlobalFilters />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <Database size={16} className="text-blue" />
            <h3 className="text-sm font-semibold text-ink-primary">Connection</h3>
          </header>
          <Field label="API base URL" value={baseUrl} mono />
          <Field label="Default client_id" value={filters.client_id || '—'} mono />
          <Field label="Date range" value={`${filters.from}  →  ${filters.to}`} mono />
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <Activity size={16} className="text-warn" />
            <h3 className="text-sm font-semibold text-ink-primary">Runtime Validation</h3>
          </header>
          <RuntimeValidationBadge />
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            Operator-side gates remain pending until the following runbook steps
            produce evidence:
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-secondary">
            <li>• <span className="font-mono text-ink-primary">npm run phase2:describe</span> → column verification</li>
            <li>• <span className="font-mono text-ink-primary">npm run dev</span> + <span className="font-mono text-ink-primary">npm run phase2:smoke</span> → 15-endpoint smoke</li>
            <li>• <span className="font-mono text-ink-primary">docs/MVP_FINAL_VALIDATION_RUNBOOK.md</span> §9 → cache + date-range evidence</li>
          </ul>
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <User2 size={16} className="text-violet" />
            <h3 className="text-sm font-semibold text-ink-primary">Operator</h3>
          </header>
          <Field label="Login ID" value={user?.login_id || '—'} mono />
          <Field label="Display name" value={user?.name || user?.login_id || '—'} />
          <Field label="Role" value={user?.role_code || '—'} />
          <Field label="Session start" value={fmtDate(new Date().toISOString())} />
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-good" />
            <h3 className="text-sm font-semibold text-ink-primary">Safety</h3>
          </header>
          <ul className="space-y-2 text-xs text-ink-secondary">
            <li>• Auth token stored only in <span className="font-mono text-ink-primary">localStorage</span>; never logged to console.</li>
            <li>• All 15 endpoints return standard envelopes (<span className="font-mono text-ink-primary">success</span> / <span className="font-mono text-ink-primary">code</span>).</li>
            <li>• <span className="font-mono text-ink-primary">supported:false</span> responses render the "Not available for this process" state.</li>
            <li>• Mobile, OTP, PIN, CVV, and long digit runs are masked client-side before render.</li>
            <li>• Transcripts displayed as truncated, masked snippets — never full raw.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`mt-1 text-sm ${mono ? 'font-mono text-ink-primary' : 'text-ink-primary'}`}>{value}</div>
    </div>
  );
}

function RuntimeValidationBadge() {
  // Status is hardcoded to "pending" until the operator runs the runbook
  // and the backend smoke gate is closed. UI does not self-promote to "passed"
  // — that is a backend truth we never fabricate.
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2">
      <span className="h-2 w-2 animate-pulse-soft rounded-full bg-warn" />
      <span className="text-xs font-semibold uppercase tracking-wider text-warn">Runtime validation pending</span>
    </div>
  );
}