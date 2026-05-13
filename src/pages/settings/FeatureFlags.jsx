import { useEffect, useMemo, useState } from 'react';
import { Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { FeatureFlags as FlagsApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/cn';

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
}

export default function FeatureFlagsPage() {
  const { user } = useAuth();
  const adminID = user?.id;
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingKey, setTogglingKey] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    FlagsApi.getAll()
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') {
          setFlags(resp.data.data || []);
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load feature flags.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load feature flags.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(flag) {
    const next = !flag.enabled;
    setTogglingKey(flag.flagKey);
    setError('');
    try {
      const resp = next
        ? await FlagsApi.enable(flag.flagKey, adminID)
        : await FlagsApi.disable(flag.flagKey, adminID);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update feature flag.');
      }
      const updated = resp.data.data;
      setFlags((prev) =>
        prev.map((f) =>
          f.flagKey === flag.flagKey
            ? {
                ...f,
                enabled: updated?.enabled ?? next,
                modified: updated?.modified ?? f.modified,
                updatedBy: updated?.updatedBy ?? f.updatedBy,
              }
            : f,
        ),
      );
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to update feature flag.',
      );
    } finally {
      setTogglingKey(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flags;
    return flags.filter((f) => {
      const hay = [f.flagKey, f.description].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [flags, query]);

  const adminGuardError = !adminID
    ? 'Loading admin session… toggles disabled until login data is available.'
    : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        subtitle="Toggle features remotely without shipping a new build."
      />

      {(error || adminGuardError) && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error || adminGuardError}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Filter by key or description…"
              leftIcon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-1 px-5 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={ToggleLeft}
              title={
                flags.length === 0
                  ? 'No feature flags yet'
                  : 'No flags match your filter'
              }
              description={
                flags.length === 0
                  ? 'Flags appear here once they\'re registered on the backend.'
                  : 'Try a different search term.'
              }
              className="border-0 bg-transparent py-0"
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <li key={f.flagKey} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                      {f.flagKey}
                    </code>
                    <StatusPill enabled={f.enabled} />
                  </div>
                  {f.description && (
                    <div className="mt-1 text-xs text-slate-500">
                      {f.description}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-slate-400">
                    Updated {formatDateTime(f.modified)}
                    {f.updatedBy ? ` · by admin #${f.updatedBy}` : ''}
                  </div>
                </div>
                <ToggleSwitch
                  enabled={f.enabled}
                  loading={togglingKey === f.flagKey}
                  disabled={togglingKey !== null || !adminID}
                  onToggle={() => handleToggle(f)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatusPill({ enabled }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        enabled
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-500',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          enabled ? 'bg-emerald-500' : 'bg-slate-400',
        )}
      />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function ToggleSwitch({ enabled, loading, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={enabled ? 'Disable flag' : 'Enable flag'}
      className={cn(
        'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-60',
        enabled ? 'bg-brand-600' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          enabled ? 'translate-x-6' : 'translate-x-1',
          loading && 'animate-pulse',
        )}
      />
      {loading ? (
        <ToggleRight className="absolute right-1 h-3 w-3 animate-pulse text-white/70" />
      ) : null}
    </button>
  );
}
