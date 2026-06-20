import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Sparkles, AlertOctagon, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) navigate('/command-center', { replace: true });
  }, [token, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) return;
    setBusy(true);
    setError(null);
    const result = await login(loginId, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.message || 'Login failed');
      // Never log the password or token
      return;
    }
    navigate('/command-center', { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_36rem_at_20%_0%,rgba(91,155,255,0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(48rem_32rem_at_85%_100%,rgba(157,123,255,0.16),transparent_65%)]" />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-strong w-full max-w-md p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet/30 to-blue/30 shadow-glow-violet">
              <Sparkles size={18} className="text-violet" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Call Master</div>
              <div className="text-lg font-semibold leading-tight text-ink-primary">Enterprise IQ</div>
            </div>
          </div>

          <h1 className="text-xl font-semibold text-ink-primary">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Use your <span className="text-ink-secondary">qa-auth</span> credentials to access the command center.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">Login ID</span>
              <input
                autoFocus
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line-subtle bg-elevated/40 px-4 py-2.5 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
                placeholder="login_id"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">Password</span>
              <div className="relative mt-1">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line-subtle bg-elevated/40 px-4 py-2.5 pr-10 text-sm text-ink-primary outline-none focus:border-violet/40 focus-ring"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:text-ink-primary focus-ring"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">
                <AlertOctagon size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy || !loginId || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet/30 bg-gradient-to-r from-violet/30 to-blue/30 px-4 py-2.5 text-sm font-semibold text-ink-primary shadow-glow-violet transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn size={16} />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-[11px] leading-relaxed text-ink-muted">
            Backend Phase 2 Task 3 is code-complete and awaits runtime validation.
            See <span className="text-ink-secondary">docs/MVP_FINAL_VALIDATION_RUNBOOK.md</span>.
          </p>
        </div>
      </div>
    </div>
  );
}