import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, RefreshCw, SearchX, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { SearchInsights as SearchInsightsApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : timeFormatter.format(d);
}

export default function SearchInsights() {
  const { can } = useAuth();
  const canEdit = can('SEARCH_INSIGHTS', 'edit');
  const canDelete = can('SEARCH_INSIGHTS', 'delete');

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);

  const load = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const resp = await SearchInsightsApi.misses({
          includeDismissed,
          page,
          size: PAGE_SIZE,
        });
        if (!mounted.current) return;
        if (resp?.data?.status !== 'SUCCESS') {
          throw new Error(resp?.data?.msg || 'Failed to load searches.');
        }
        const data = resp.data.data;
        setRows(data?.content ?? []);
        setTotalPages(data?.totalPages ?? 0);
        setTotalElements(data?.totalElements ?? 0);
        setError('');
      } catch (err) {
        if (!mounted.current) return;
        setError(err?.response?.data?.msg || err?.message || 'Failed to load searches.');
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [includeDismissed, page],
  );

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const act = useCallback(
    async (id, fn, failMsg) => {
      setBusyId(id);
      try {
        const resp = await fn(id);
        if (resp?.data?.status !== 'SUCCESS') throw new Error(resp?.data?.msg || failMsg);
        await load();
      } catch (err) {
        if (mounted.current) {
          setError(err?.response?.data?.msg || err?.message || failMsg);
        }
      } finally {
        if (mounted.current) setBusyId(null);
      }
    },
    [load],
  );

  const maxHits = rows.reduce((m, r) => Math.max(m, r.hitCount), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Insights"
        subtitle="What users searched for in the app and found nothing. Add these vehicles or brands to the catalog, then mark them handled."
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

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SearchX className="h-4 w-4 text-slate-500" />
            Searches with no results
            {!loading && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {totalElements}
              </span>
            )}
          </CardTitle>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={includeDismissed}
              onChange={(e) => {
                setPage(0);
                setLoading(true);
                setIncludeDismissed(e.target.checked);
              }}
            />
            Show handled
          </label>
        </CardHeader>
        <CardBody className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No missed searches"
              description="Every search users ran found something. Nothing to add right now."
            />
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                  r.dismissed ? 'border-slate-100 bg-slate-50 opacity-70' : 'border-slate-200 bg-white',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {r.queryText}
                    </span>
                    {r.dismissed && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Handled
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(6, (r.hitCount / maxHits) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    First seen {formatDay(r.firstSeen)} · last seen {formatDay(r.lastSeen)}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <div className="text-right">
                    <div className="text-lg font-bold leading-none text-slate-900">{r.hitCount}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.hitCount === 1 ? 'search' : 'searches'}
                    </div>
                  </div>
                  {canEdit && !r.dismissed && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, SearchInsightsApi.dismiss, 'Failed to mark handled.')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark handled
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => {
                        if (window.confirm(`Delete "${r.queryText}" from the list?`)) {
                          act(r.id, SearchInsightsApi.remove, 'Failed to delete.');
                        }
                      }}
                      className="inline-flex items-center rounded-lg border border-red-200 bg-white p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
