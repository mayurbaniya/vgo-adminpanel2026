import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Login failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-lg font-bold tracking-tight">VGO Admin</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Run the marketplace.
            <br />
            From one place.
          </h1>
          <p className="mt-3 max-w-md text-sm text-brand-100/80">
            Manage vehicles, leads, partners and finance — all from a single
            console wired into the wheely backend.
          </p>
        </div>
        <div className="text-xs text-brand-200/70">
          © {new Date().getFullYear()} Wheely · Internal use only
        </div>
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 lg:hidden">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your admin credentials to access the console.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@wheely.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>

            <p className="pt-2 text-center text-xs text-slate-500">
              Need an admin account?{' '}
              <span className="font-semibold text-slate-700">
                Contact @Tashi.
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
