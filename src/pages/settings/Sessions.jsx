import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Sessions as SessionsApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : timeFormatter.format(d);
}

// Coarse, dependency-free User-Agent summary — enough to tell sessions
// apart ("Chrome on Windows"), not a fingerprinting attempt.
function describeDevice(ua) {
  if (!ua) return 'Unknown device';
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/i.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : null;
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/i.test(ua)
      ? 'Opera'
      : /Chrome\//i.test(ua)
        ? 'Chrome'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : /Safari\//i.test(ua)
            ? 'Safari'
            : /okhttp|Dart/i.test(ua)
              ? 'Mobile app'
              : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}

function SessionRow({ session }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        session.current
          ? 'border-brand-200 bg-brand-50/50'
          : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <MonitorSmartphone className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {describeDevice(session.deviceInfo)}
            </span>
            {session.current && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                This session
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {session.ip || 'IP unknown'}
            </span>
            <span>Signed in {formatTime(session.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-slate-500 sm:text-right">
        <div>Last active {formatTime(session.lastUsedAt)}</div>
        <div>Expires {formatTime(session.expiryDate)}</div>
      </div>
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const resp = await SessionsApi.list();
      if (!mounted.current) return;
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to load sessions.');
      }
      setSessions(resp.data.data ?? []);
      setError('');
    } catch (err) {
      if (!mounted.current) return;
      setError(err?.response?.data?.msg || err?.message || 'Failed to load sessions.');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const otherCount = sessions.filter((s) => !s.current).length;

  const logoutOthers = useCallback(async () => {
    if (
      !window.confirm(
        `Log out ${otherCount} other session(s)? Devices signed in elsewhere will need to sign in again.`,
      )
    ) {
      return;
    }
    setRevoking(true);
    setNotice('');
    try {
      const resp = await SessionsApi.logoutOthers();
      if (!mounted.current) return;
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to log out other sessions.');
      }
      setNotice(resp.data.msg || 'Other sessions logged out.');
      setError('');
      await load();
    } catch (err) {
      if (!mounted.current) return;
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to log out other sessions.',
      );
    } finally {
      if (mounted.current) setRevoking(false);
    }
  }, [load, otherCount]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        subtitle="Everywhere your admin account is currently signed in."
        actions={
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            Active sessions
          </CardTitle>
          {!loading && otherCount > 0 && (
            <button
              type="button"
              onClick={logoutOthers}
              disabled={revoking}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <LogOut className="h-3.5 w-3.5" />
              {revoking ? 'Logging out…' : `Log out other sessions (${otherCount})`}
            </button>
          )}
        </CardHeader>
        <CardBody className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))
          ) : sessions.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No active sessions found.
            </div>
          ) : (
            sessions.map((s) => <SessionRow key={s.id} session={s} />)
          )}
          {!loading && (
            <p className="pt-1 text-xs text-slate-400">
              Sessions started before this feature was added may show as
              &ldquo;Unknown device&rdquo;. Logged-out sessions lose access within an
              hour at most (until their current access token expires).
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
