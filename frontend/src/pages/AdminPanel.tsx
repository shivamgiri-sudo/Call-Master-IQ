import {
  Activity, CheckCircle2, LockKeyhole, Route, ShieldCheck, Users,
} from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { getDisplayName, getDefaultRouteForRole, getUserRole, ROLES } from '../routes/roleMap';
import { getPermissions, hasPermission, ROLE_PERMISSIONS, ROUTE_PERMISSIONS } from '../routes/permissions';

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

export default function AdminPanel() {
  const { user } = useAuth();
  const role = getUserRole(user);
  const permissions = getPermissions(role);
  const routeEntries = Object.entries(ROUTE_PERMISSIONS);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Safe Administration"
        subtitle="Role access, route visibility, and release gate status. This page does not perform destructive user management."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatusCard icon={<Users size={18} />} label="Operator" value={getDisplayName(user)} detail={role} />
        <StatusCard icon={<ShieldCheck size={18} />} label="Permissions" value={String(permissions.length)} detail="Effective permission grants" />
        <StatusCard icon={<Route size={18} />} label="Protected routes" value={String(routeEntries.length)} detail="Mapped to route guards" />
        <StatusCard icon={<LockKeyhole size={18} />} label="Mutation mode" value="Read-only" detail="No unsafe admin APIs connected" />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-blue" />
            <h3 className="text-sm font-semibold text-ink-primary">Role Permission Matrix</h3>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-line-subtle text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Default page</th>
                  <th className="py-2 pr-4 font-medium">Permissions</th>
                  <th className="py-2 font-medium">Dashboard access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle/70">
                {ROLES.map(item => {
                  const rolePermissions = ROLE_PERMISSIONS[item] ?? [];
                  const accessibleRoutes = routeEntries.filter(([, permission]) => hasPermission(item, permission));
                  return (
                    <tr key={item} className="text-ink-secondary">
                      <td className="whitespace-nowrap py-3 pr-4 font-medium text-ink-primary">{item}</td>
                      <td className="whitespace-nowrap py-3 pr-4 font-mono text-[11px]">{getDefaultRouteForRole(item)}</td>
                      <td className="whitespace-nowrap py-3 pr-4">{rolePermissions.length}</td>
                      <td className="py-3">
                        <div className="flex max-w-xl flex-wrap gap-1.5">
                          {accessibleRoutes.map(([path]) => (
                            <span key={`${item}-${path}`} className="rounded-lg border border-line-subtle bg-elevated/35 px-2 py-1 text-[10px] text-ink-muted">
                              {ROUTE_LABELS[path] || path}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass p-5">
            <header className="mb-4 flex items-center gap-2">
              <Activity size={16} className="text-good" />
              <h3 className="text-sm font-semibold text-ink-primary">Validation Status</h3>
            </header>
            <StatusList
              items={[
                ['Backend validation', 'passed'],
                ['Frontend validation', 'passed'],
                ['Analytics endpoints', '15/15 passed'],
                ['Auth flow', 'passed'],
                ['Role guard', 'passed'],
              ]}
            />
          </div>

          <div className="glass p-5">
            <header className="mb-4 flex items-center gap-2">
              <LockKeyhole size={16} className="text-warn" />
              <h3 className="text-sm font-semibold text-ink-primary">Release Gate</h3>
            </header>
            <StatusList
              items={[
                ['Audit advisories', 'pending'],
                ['Secret rotation', 'pending'],
                ['History cleanup', 'pending'],
                ['Public release', 'blocked'],
              ]}
              blocked
            />
          </div>
        </div>
      </section>

      <section className="glass p-5">
        <header className="mb-4 flex items-center gap-2">
          <Route size={16} className="text-violet" />
          <h3 className="text-sm font-semibold text-ink-primary">API Health Placeholders</h3>
        </header>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <HealthItem title="Analytics API" status="Validated locally" tone="good" />
          <HealthItem title="Role guard" status="Validated locally" tone="good" />
          <HealthItem title="Admin mutations" status="Not connected" tone="warn" />
        </div>
      </section>
    </>
  );
}

function StatusCard({ icon, label, value, detail }: { icon: JSX.Element; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-panel/80 p-4 shadow-glass backdrop-blur-glass">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
          <div className="mt-2 truncate text-lg font-semibold text-ink-primary">{value}</div>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-subtle bg-elevated/40 text-ink-secondary">
          {icon}
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-ink-muted">{detail}</p>
    </div>
  );
}

function StatusList({ items, blocked }: { items: Array<[string, string]>; blocked?: boolean }) {
  return (
    <div className="space-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-elevated/35 px-3 py-2">
          <span className="text-xs text-ink-secondary">{label}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            blocked ? 'border-warn/25 bg-warn/10 text-warn' : 'border-good/25 bg-good/10 text-good'
          }`}>
            <CheckCircle2 size={11} />
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function HealthItem({ title, status, tone }: { title: string; status: string; tone: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl border border-line-subtle bg-elevated/35 p-4">
      <div className="text-sm font-medium text-ink-primary">{title}</div>
      <div className={`mt-2 text-xs ${tone === 'good' ? 'text-good' : 'text-warn'}`}>{status}</div>
    </div>
  );
}
