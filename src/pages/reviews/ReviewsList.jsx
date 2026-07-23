import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquare,
  RotateCcw,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Reviews as ReviewsApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

// Backend moderation states (1 = visible, 99 = hidden, 0 = soft-deleted).
const STATUS_VISIBLE = 1;
const STATUS_HIDDEN = 99;
const STATUS_DELETED = 0;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'created', label: 'Newest' },
  { value: 'rating', label: 'Rating' },
];
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: STATUS_VISIBLE, label: 'Visible' },
  { value: STATUS_HIDDEN, label: 'Hidden' },
  { value: STATUS_DELETED, label: 'Deleted' },
];

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
}

export default function ReviewsList() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('created');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Reset to page 0 whenever the status filter changes.
  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ReviewsApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS' || status === 'EMPTY') {
          const payload = resp.data.data;
          const totalPages = payload?.totalPages ?? 0;
          const pageNumber = payload?.pageNumber ?? page;
          const lastPage =
            payload?.lastPage ?? pageNumber >= Math.max(0, totalPages - 1);
          setItems(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load reviews.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load reviews.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, statusFilter, reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function runAction(review, action) {
    setMutatingId(review.id);
    setError('');
    try {
      let resp;
      if (action === 'hide') resp = await ReviewsApi.hide(review.id);
      else if (action === 'unhide') resp = await ReviewsApi.unhide(review.id);
      else resp = await ReviewsApi.delete(review.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update review.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to update review.',
      );
    } finally {
      setMutatingId(null);
    }
  }

  const showingFrom =
    meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0
      ? 0
      : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        subtitle="Owner reviews are public on submission — hide or remove anything inappropriate."
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={String(f.value)}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  statusFilter === f.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ToolbarSelect
              label="Sort by"
              value={sortBy}
              onChange={(v) => {
                setSortBy(v);
                setPage(0);
              }}
              options={SORT_OPTIONS}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                setPage(0);
              }}
            >
              {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
            </Button>
            <ToolbarSelect
              label="Per page"
              value={pageSize}
              onChange={(v) => {
                setPageSize(v);
                setPage(0);
              }}
              options={PAGE_SIZE_OPTIONS.map((n) => ({
                value: n,
                label: String(n),
              }))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Comment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Posted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <EmptyState
                      icon={MessageSquare}
                      title="No reviews"
                      description={
                        statusFilter === 'all'
                          ? 'No reviews have been submitted yet.'
                          : 'No reviews in this state.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {r.reviewer || 'Anonymous'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {r.vehicleModel || `#${r.vehicleId ?? '—'}`}
                    </td>
                    <td className="px-4 py-3.5">
                      <Stars value={r.rating} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        className="max-w-xs truncate text-slate-600"
                        title={r.comment || ''}
                      >
                        {r.comment || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(r.created)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === STATUS_VISIBLE && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={mutatingId === r.id}
                            disabled={mutatingId !== null}
                            onClick={() => runAction(r, 'hide')}
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            Hide
                          </Button>
                        )}
                        {r.status === STATUS_HIDDEN && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={mutatingId === r.id}
                            disabled={mutatingId !== null}
                            onClick={() => runAction(r, 'unhide')}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Unhide
                          </Button>
                        )}
                        {r.status === STATUS_DELETED && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={mutatingId === r.id}
                            disabled={mutatingId !== null}
                            onClick={() => runAction(r, 'unhide')}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                        )}
                        {r.status !== STATUS_DELETED && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={mutatingId !== null}
                            onClick={() => setConfirmDelete(r)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {loading
              ? 'Loading…'
              : meta.totalElements === 0
                ? 'No reviews.'
                : `Showing ${showingFrom}–${showingTo} of ${meta.totalElements}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={loading || meta.pageNumber === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <div className="px-2 text-slate-600">
              Page {meta.pageNumber + 1} of {Math.max(1, meta.totalPages)}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || meta.lastPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        dismissible={mutatingId === null}
        title="Delete review?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(null)}
              disabled={mutatingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={mutatingId !== null}
              onClick={async () => {
                const review = confirmDelete;
                if (!review) return;
                await runAction(review, 'delete');
                setConfirmDelete(null);
              }}
            >
              Delete review
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This removes the review from the app. It is a soft delete — you can
          restore it later from the “Deleted” filter.
        </p>
      </Modal>
    </div>
  );
}

function ToolbarSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-1.5 text-slate-600">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          const opt = options.find((o) => String(o.value) === v);
          onChange(opt ? opt.value : v);
        }}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stars({ value }) {
  const v = Math.max(0, Math.min(5, value || 0));
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3.5 w-3.5',
            s <= v ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
          )}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    [STATUS_VISIBLE]: {
      label: 'Visible',
      dot: 'bg-emerald-500',
      cls: 'bg-emerald-50 text-emerald-700',
    },
    [STATUS_HIDDEN]: {
      label: 'Hidden',
      dot: 'bg-amber-500',
      cls: 'bg-amber-50 text-amber-700',
    },
    [STATUS_DELETED]: {
      label: 'Deleted',
      dot: 'bg-slate-400',
      cls: 'bg-slate-100 text-slate-600',
    },
  };
  const s = map[status] || map[STATUS_VISIBLE];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        s.cls,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}
