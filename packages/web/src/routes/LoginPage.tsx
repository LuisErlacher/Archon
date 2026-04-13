import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/AuthContext';
import { loginApi, registerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'register';

export function LoginPage(): React.ReactElement {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result =
        mode === 'login'
          ? await loginApi(username, password)
          : await registerApi(username, password, displayName || undefined);

      auth.login(result.accessToken, result.refreshToken, result.user);
      navigate('/chat');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('401')) {
        setError('Invalid username or password');
      } else if (msg.includes('409')) {
        setError('Username already taken');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-surface p-8">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-semibold text-primary-foreground">A</span>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-text-primary">Archon</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e): void => {
                setUsername(e.target.value);
              }}
              required
              minLength={mode === 'register' ? 3 : undefined}
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e): void => {
                setPassword(e.target.value);
              }}
              required
              minLength={mode === 'register' ? 8 : undefined}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Display Name (optional)
              </label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e): void => {
                  setDisplayName(e.target.value);
                }}
              />
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="text-center text-sm text-text-secondary">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-primary hover:underline"
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
