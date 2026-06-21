import { BadgeCheck, ShieldCheck, User2 } from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { getDisplayName, getUserRole } from '../routes/roleMap';
import { getPermissions } from '../routes/permissions';

export default function Profile() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const permissions = getPermissions(role);

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="My Call Master IQ Workspace"
        subtitle="Role, scope, and read-only session details for the current operator."
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass p-5">
          <header className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-violet/30 bg-violet/10 text-violet">
              <User2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-primary">{getDisplayName(user)}</h2>
              <p className="text-xs uppercase tracking-wider text-ink-muted">{role}</p>
            </div>
          </header>
          <Field label="Login ID" value={String(user?.login_id || '-')} />
          <Field label="Email" value={String(user?.email || '-')} />
          <Field label="Branch" value={String(user?.branch_short_name || '-')} />
          <Field label="Employee code" value={String(user?.employee_code || '-')} />
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-good" />
            <h3 className="text-sm font-semibold text-ink-primary">Permissions</h3>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {permissions.map(permission => (
              <div key={permission} className="flex items-center gap-2 rounded-lg border border-line-subtle bg-elevated/35 px-3 py-2 text-xs text-ink-secondary">
                <BadgeCheck size={13} className="text-good" />
                <span className="truncate">{permission}</span>
              </div>
            ))}
          </div>
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
