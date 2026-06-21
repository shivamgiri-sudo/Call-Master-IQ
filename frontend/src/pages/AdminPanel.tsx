import {
  Activity, CheckCircle2, Filter, LockKeyhole, Route, Search, ShieldCheck, Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const userManagementAvailable = false;
  const matchingRoles = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return ROLES.filter(item => (roleFilter === 'ALL' || item === roleFilter) && (!q || item.toLowerCase().includes(q)));
  }, [roleFilter, userSearch]);

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
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              Label: Last local validation result.
            </p>
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

      <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-blue" />
            <h3 className="text-sm font-semibold text-ink-primary">User Management</h3>
          </header>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users or roles..."
                className="w-full rounded-lg border border-line-subtle bg-elevated/40 py-2 pl-9 pr-3 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-violet/40 focus-ring"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="rounded-lg border border-line-subtle bg-elevated/40 py-2 pl-9 pr-3 text-sm text-ink-primary focus-ring"
              >
                <option value="ALL">All roles</option>
                {ROLES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
            <div className="text-sm font-semibold text-warn">User management backend API not available yet.</div>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              This screen is ready for search, role filter, role badges, access level, and active/inactive status once a safe read-only users endpoint is added.
              No dummy users, passwords, tokens, or secrets are displayed.
            </p>
          </div>
        </div>

        <div className="glass p-5">
          <header className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-good" />
            <h3 className="text-sm font-semibold text-ink-primary">Permission Explanation</h3>
          </header>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {matchingRoles.map(item => {
              const rolePermissions = ROLE_PERMISSIONS[item] ?? [];
              const routeCount = routeEntries.filter(([, permission]) => hasPermission(item, permission)).length;
              return (
                <div key={item} className="rounded-xl border border-line-subtle bg-elevated/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink-primary">{item}</span>
                    <span className="pill pill-info">{routeCount} pages</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">
                    {rolePermissions.length} permissions. Default access: <span className="font-mono text-ink-secondary">{getDefaultRouteForRole(item)}</span>
                  </p>
                </div>
              );
            })}
          </div>
          {!userManagementAvailable ? (
            <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
              Current access levels are derived from the local role matrix, not a live user directory.
            </p>
          ) : null}
        </div>
      </section>

      <section className="glass p-5">
        <header className="mb-4 flex items-center gap-2">
          <Route size={16} className="text-violet" />
          <h3 className="text-sm font-semibold text-ink-primary">API Health & System Readiness Center</h3>
        </header>
        <p className="mb-4 text-xs text-ink-muted">Last local validation result.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <HealthItem title="Auth API" status="Validated locally" tone="good" />
          <HealthItem title="Analytics API" status="15/15 passed" tone="good" />
          <HealthItem title="Filter options API" status="Validated locally" tone="good" />
          <HealthItem title="Drilldown API" status="Validated locally" tone="good" />
          <HealthItem title="Frontend build status" status="Passed" tone="good" />
          <HealthItem title="Backend build status" status="Passed" tone="good" />
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
