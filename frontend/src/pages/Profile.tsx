import { BadgeCheck, LogOut, Route, ShieldCheck, User2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole, getDisplayName, getUserRole } from '../routes/roleMap';
import { getPermissions, hasPermission, ROUTE_PERMISSIONS } from '../routes/permissions';

const ROUTE_LABELS: Record<string, string> = {
  '/command-center': 'Command Center',
  '/quality': 'Quality',
  '/sales-funnel': 'Sales Funnel',
  '/risk': 'Risk Queue',
  '/tni': 'TNI Heatmap',
  '/analysts': 'Analysts',
  '/evidence': 'Evidence',
  '/settings': 'Settings',
  '/admin': 'Admin',
  '/profile': 'Profile',
};

export default function Profile() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const role = getUserRole(user);
  const permissions = getPermissions(role);
  const accessiblePages = Object.entries(ROUTE_PERMISSIONS)
    .filter(([, permission]) => hasPermission(role, permission))
    .map(([path]) => ({ path, label: ROUTE_LABELS[path] || path }));
  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
          <Field label="Default landing" value={getDefaultRouteForRole(role)} />
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-elevated/35 p-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-muted">Session</div>
              <div className="mt-1 text-sm font-medium text-good">{token ? 'Active' : 'Inactive'}</div>
            </div>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-line-subtle bg-panel/50 px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-bad/35 hover:text-bad focus-ring"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
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

        <div className="glass p-5 xl:col-span-2">
          <header className="mb-4 flex items-center gap-2">
            <Route size={16} className="text-blue" />
            <h3 className="text-sm font-semibold text-ink-primary">Accessible Pages</h3>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {accessiblePages.map(page => (
              <Link
                key={page.path}
                to={page.path}
                className="rounded-xl border border-line-subtle bg-elevated/35 px-3 py-3 text-sm text-ink-secondary transition-colors hover:border-line-strong hover:text-ink-primary focus-ring"
              >
                <span className="block font-medium text-ink-primary">{page.label}</span>
                <span className="mt-1 block font-mono text-[11px] text-ink-muted">{page.path}</span>
              </Link>
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
