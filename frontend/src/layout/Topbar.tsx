import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Activity, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TopbarProps {
  onMenuClick: () => void;
  userLabel: string;
  userRole: string;
}

export default function Topbar({ onMenuClick, userLabel, userRole }: TopbarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line-subtle bg-base/75 px-4 backdrop-blur-glass md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-subtle bg-elevated/50 text-ink-secondary hover:text-ink-primary focus-ring md:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-elevated/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            <Activity size={11} className="text-good" />
            Live
          </span>
          <span className="text-xs text-ink-muted">
            AI Quality · Sales · Coaching · Risk · Evidence
          </span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden w-[320px] items-center gap-2 rounded-lg border border-line-subtle bg-elevated/35 px-3 py-2 text-sm text-ink-muted lg:flex">
          <Search size={15} />
          Search calls, analysts, risk evidence
        </div>
        <button
          className="hidden h-9 w-9 place-items-center rounded-lg border border-line-subtle bg-elevated/45 text-ink-secondary hover:text-ink-primary focus-ring sm:grid"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={16} />
        </button>
        <div className="hidden text-right md:block">
          <div className="text-sm font-medium leading-tight text-ink-primary">{userLabel}</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">{userRole}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-line-subtle bg-elevated/40 text-sm font-semibold text-ink-secondary">
          {userLabel.slice(0, 1).toUpperCase()}
        </div>
        <button
          onClick={handleLogout}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line-subtle bg-elevated/50 text-ink-secondary hover:text-bad focus-ring"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
