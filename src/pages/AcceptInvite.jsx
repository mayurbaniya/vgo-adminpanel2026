import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext.jsx';
import { StaffInvite } from '@/api/endpoints.js';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';

export default function AcceptInvite() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [invite, setInvite] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) {
      setVerifyError('This invite link is missing its token.');
      setVerifying(false);
      return;
    }
    let cancelled = false;
    StaffInvite.verify(token)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setInvite(resp.data.data);
        } else {
          setVerifyError(resp?.data?.msg || 'This invite link is invalid.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setVerifyError(err?.response?.data?.msg || 'This invite link is invalid or has expired.');
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await StaffInvite.accept({ token, password });
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to activate your account.');
      }
      setSession(resp.data.data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(err?.response?.data?.msg || err?.message || 'Failed to activate your account.');
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-lg font-bold tracking-tight">VGO Admin</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            You&apos;re almost in.
          </h1>
          <p className="mt-3 max-w-md text-sm text-brand-100/80">
            Set a password only you will ever know, and you&apos;re straight into the console.
          </p>
        </div>
        <div className="text-xs text-brand-200/70">
          © {new Date().getFullYear()} Wheely · Internal use only
        </div>
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-sm">
          {verifying ? (
            <p className="text-sm text-slate-500">Checking your invite…</p>
          ) : verifyError ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {verifyError}
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 lg:hidden">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Welcome, {invite?.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  You&apos;ve been invited as <strong>{invite?.roleName}</strong>. Set a password to
                  activate your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </div>

                <div>
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {submitError}
                  </div>
                )}

                <Button type="submit" loading={submitting} className="w-full">
                  Set password &amp; sign in
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
