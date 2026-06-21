import { ShieldCheck, Users } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { getDisplayName, getUserRole } from '../routes/roleMap';

export default function AdminPanel() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Admin Panel"
        subtitle="User and role administration surface for the current Call Master backend module."
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-blue" />
            <h3 className="text-sm font-semibold text-ink-primary">Directory</h3>
          </header>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Admin functions are not available in current backend module.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            This page is permission-gated for SUPER_ADMIN and HR_ADMIN. It does not invent user-management data or call unsupported APIs.
          </p>
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-good" />
            <h3 className="text-sm font-semibold text-ink-primary">Current Access</h3>
          </header>
          <Field label="Operator" value={getDisplayName(user)} />
          <Field label="Normalized role" value={getUserRole(user)} />
          <Field label="Backend status" value="No safe admin API connected" />
        </div>
      </section>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1 text-sm text-ink-primary">{value}</div>
    </div>
  );
}
