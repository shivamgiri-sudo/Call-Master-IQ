import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../context/AuthContext';
import { getDisplayName, getUserRole } from '../routes/roleMap';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen text-ink-primary">
      {/* Radial backdrop layers — subtle, behind everything */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(40rem_24rem_at_15%_-10%,rgba(91,155,255,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(36rem_28rem_at_110%_120%,rgba(157,123,255,0.08),transparent_65%)]" />
      </div>

      <div className="flex min-h-screen">
        {/* Sidebar — desktop persistent, mobile drawer */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setSidebarOpen(true)} userLabel={getDisplayName(user)} userRole={getUserRole(user)} />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-[1480px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
