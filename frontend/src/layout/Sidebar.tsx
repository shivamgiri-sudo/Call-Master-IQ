import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Flame,
  Users,
  Search,
  Settings,
  X,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/command-center', label: 'Executive Command Center', icon: LayoutDashboard },
  { to: '/quality', label: 'Quality Intelligence', icon: ShieldCheck },
  { to: '/sales-funnel', label: 'Sales Funnel Intelligence', icon: TrendingUp },
  { to: '/risk', label: 'Risk & Compliance Queue', icon: AlertTriangle },
  { to: '/tni', label: 'TNI / Coaching Heatmap', icon: Flame },
  { to: '/analysts', label: 'Analyst Performance', icon: Users },
  { to: '/evidence', label: 'Evidence Drilldown', icon: Search },
  { to: '/settings', label: 'Settings & Filters', icon: Settings },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-72 transform border-r border-line-subtle bg-panel/85 backdrop-blur-glass transition-transform md:static md:translate-x-0 md:w-64 md:bg-panel/70',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet/30 to-blue/30 shadow-glow-violet">
              <Sparkles size={16} className="text-violet" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Call Master</div>
              <div className="text-sm font-semibold leading-tight text-ink-primary">Enterprise IQ</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-line-subtle bg-elevated/50 text-ink-secondary hover:text-ink-primary focus-ring md:hidden"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="mt-3 flex flex-col gap-1 px-3">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-ring',
                  isActive
                    ? 'bg-elevated/80 text-ink-primary shadow-glass'
                    : 'text-ink-secondary hover:bg-elevated/40 hover:text-ink-primary',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      'grid h-7 w-7 place-items-center rounded-lg border transition-colors',
                      isActive
                        ? 'border-violet/40 bg-violet/15 text-violet'
                        : 'border-line-subtle bg-elevated/40 text-ink-secondary group-hover:text-ink-primary',
                    ].join(' ')}
                  >
                    <item.icon size={15} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 mx-3 rounded-2xl border border-line-subtle bg-elevated/40 p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">Runtime Validation</div>
          <div className="mt-2 text-sm font-medium text-ink-primary">Pending</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Backend MVP awaits operator-side runtime evidence. Frontend is gated accordingly — see
            <span className="text-ink-secondary"> docs/MVP_FINAL_VALIDATION_RUNBOOK.md</span>.
          </p>
        </div>
      </aside>
    </>
  );
}