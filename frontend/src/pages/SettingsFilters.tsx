import { Activity, AlertTriangle, CheckCircle2, Database, LockKeyhole, ShieldCheck, User2 } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import GlobalFilters from '../components/filters/GlobalFilters';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FiltersContext';
import { getBaseUrl } from '../api/httpClient';
import { getPermissions } from '../routes/permissions';
import { getUserRole } from '../routes/roleMap';
import { fmtDate } from '../utils/formatters';

export default function SettingsFilters() {
  const { user } = useAuth();
  const { filters } = useFilters();
  const baseUrl = getBaseUrl();
  const role = getUserRole(user);
  const permissions = getPermissions(role);

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
            Local runtime gates are passed from the accepted validation evidence.
            Public release remains blocked until the remaining safety gates close.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Gate label="Backend validation" status="passed" />
            <Gate label="Frontend validation" status="passed" />
            <Gate label="Analytics endpoints" status="15/15 passed" />
            <Gate label="Auth and role guard" status="passed" />
            <Gate label="Audit advisories" status="pending" blocked />
            <Gate label="Secret rotation" status="pending" blocked />
            <Gate label="History cleanup" status="pending" blocked />
            <Gate label="Public release" status="blocked" blocked />
          </div>
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <User2 size={16} className="text-violet" />
            <h3 className="text-sm font-semibold text-ink-primary">Operator</h3>
          </header>
          <Field label="Login ID" value={user?.login_id || '—'} mono />
          <Field label="Display name" value={user?.name || user?.login_id || '—'} />
          <Field label="Role" value={role} />
          <Field label="Session start" value={fmtDate(new Date().toISOString())} />
          <div className="mt-4">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-ink-muted">Permissions</div>
            <div className="flex flex-wrap gap-2">
              {permissions.map(permission => (
                <span key={permission} className="rounded-lg border border-line-subtle bg-elevated/35 px-2 py-1 text-[10px] text-ink-secondary">
                  {permission}
                </span>
              ))}
            </div>
          </div>
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
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-good/30 bg-good/10 px-3 py-2">
      <CheckCircle2 size={14} className="text-good" />
      <span className="text-xs font-semibold uppercase tracking-wider text-good">Runtime validation passed locally</span>
    </div>
  );
}

function Gate({ label, status, blocked }: { label: string; status: string; blocked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-elevated/35 px-3 py-2">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
        blocked ? 'border-warn/25 bg-warn/10 text-warn' : 'border-good/25 bg-good/10 text-good'
      }`}>
        {blocked ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
        {status}
      </span>
    </div>
  );
}
