import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await login(password);
      navigate(from, { replace: true });
    } catch {
      setError('Invalid password');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-8">
        <h1 className="mb-6 text-center text-xl font-semibold text-text-primary">Sign In</h1>
        {error && (
          <p className="mb-4 rounded-md bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
            }}
            className="rounded-md border border-border bg-background px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Signing in\u2026' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
