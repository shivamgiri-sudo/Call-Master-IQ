import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole, getUserRole } from '../routes/roleMap';

export default function Unauthorized() {
  const { user } = useAuth();
  const role = getUserRole(user);

  return (
    <div className="glass mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-warn/30 bg-warn/10 text-warn">
        <ShieldAlert size={26} />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-ink-primary">Unauthorized</h1>
        <p className="max-w-md text-sm leading-relaxed text-ink-secondary">
          Your current role does not include permission for this Call Master IQ workspace.
        </p>
      </div>
      <Link
        to={getDefaultRouteForRole(role)}
        className="rounded-xl border border-line-default bg-elevated/60 px-4 py-2 text-sm font-medium text-ink-primary hover:border-line-strong focus-ring"
      >
        Go to allowed dashboard
      </Link>
    </div>
  );
}
