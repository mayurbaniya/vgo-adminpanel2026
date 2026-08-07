import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Loans as LoansApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

const STATUSES = ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED'];
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];
const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'PRE_QUALIFICATION', label: 'Pre-qualification' },
  { value: 'FULL_APPLICATION', label: 'Full application' },
];
const SORT_OPTIONS = [
  { value: 'created', label: 'Newest' },
  { value: 'status', label: 'Status' },
];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function money(v) {
  if (v == null || v === 0) return '—';
  return `₹${inr.format(v)}`;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
}

export default function LoanLeadsList() {
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
  const [sourceFilter, setSourceFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Reset to page 0 when a filter changes.
  useEffect(() => {
    setPage(0);
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    LoansApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      status: statusFilter === 'all' ? undefined : statusFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
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
          throw new Error(resp?.data?.msg || 'Failed to load loan leads.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load loan leads.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, statusFilter, sourceFilter, reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function changeStatus(loan, newStatus) {
    if (newStatus === loan.status) return;
    setMutatingId(loan.id);
    setError('');
    try {
      const resp = await LoansApi.updateStatus(loan.id, newStatus);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update status.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to update status.',
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
        title="Loan Leads"
        subtitle="Pre-qualification submissions and detailed loan applications from the consumer app."
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
                key={f.value}
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
              label="Source"
              value={sourceFilter}
              onChange={setSourceFilter}
              options={SOURCE_FILTERS}
            />
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
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Income / mo</th>
                <th className="px-4 py-3">Down payment</th>
                <th className="px-4 py-3">Est. eligible</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      icon={Wallet}
                      title="No loan leads"
                      description="No loan applications or pre-qualifications match this filter."
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                items.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        {loan.userName || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {loan.userPhone || '—'}
                        {loan.employmentType ? ` · ${loan.employmentType}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {[loan.brand, loan.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {money(loan.monthlyIncome)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {money(loan.downPayment)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {money(loan.estimatedEligibleAmount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <SourceBadge source={loan.source} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(loan.created)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusSelect
                        value={loan.status}
                        disabled={mutatingId !== null}
                        onChange={(v) => changeStatus(loan, v)}
                      />
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
                ? 'No loan leads.'
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

function SourceBadge({ source }) {
  const isPreQual = source === 'PRE_QUALIFICATION';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isPreQual
          ? 'bg-brand-50 text-brand-700'
          : 'bg-slate-100 text-slate-600',
      )}
    >
      {isPreQual ? 'Pre-qualification' : 'Full application'}
    </span>
  );
}

function statusClass(status) {
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PROCESSING':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'REJECTED':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function StatusSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value || 'PENDING'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-md border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50',
        statusClass(value),
      )}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
