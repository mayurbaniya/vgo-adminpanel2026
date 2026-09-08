import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageCircle,
  Search,
  Send,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { InterestAbandonment as InterestAbandonmentApi } from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'visitedAt', label: 'Visited' },
  { value: 'lastReminderAt', label: 'Last reminder' },
  { value: 'remindersSent', label: 'Pushes sent' },
];
const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CONVERTED', label: 'Converted' },
];
const MAX_REMINDERS = 5;

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : dateTimeFormatter.format(d);
}

// Stored phone numbers are bare 10-digit Indian mobile numbers (see
// complete_profile.dart's "Enter a valid 10-digit phone number" validation)
// — wa.me needs the full international number with no leading +.
function toWhatsAppDigits(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10) return digits; // already carries a country code
  return null;
}

function buildWhatsAppMessage(row) {
  const name = row.userName?.trim() || 'there';
  const vehicle = row.vehicleModel?.trim() || 'the vehicle';
  const price = row.vehiclePriceRange?.trim();
  const priceLine = price ? ` (${price})` : '';
  return (
    `Hi ${name}! 👋 This is from VGO Mobility.\n\n` +
    `I noticed you were checking out the *${vehicle}*${priceLine} recently and wanted to check in — it's still available!\n\n` +
    `Happy to answer any questions or help you take the next step whenever you're ready.\n\n` +
    `Thanks!`
  );
}

function buildWhatsAppLink(row) {
  const digits = toWhatsAppDigits(row.userPhone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildWhatsAppMessage(row))}`;
}

export default function InterestAbandonmentList() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('visitedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    InterestAbandonmentApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      status: statusFilter,
      q: debouncedQuery.trim() || undefined,
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
          setRows(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load interest nudges.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load interest nudges.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, statusFilter, debouncedQuery]);

  // Opens the wa.me link (the actual "send" happens in WhatsApp itself, by
  // the admin) and marks it sent — best-effort, self-reported; see the
  // backend note on InterestAbandonment.lastWhatsappSentAt.
  async function handleWhatsApp(row) {
    const link = buildWhatsAppLink(row);
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');

    setSendingId(row.id);
    try {
      const resp = await InterestAbandonmentApi.markWhatsappSent(row.id);
      if (resp?.data?.status === 'SUCCESS') {
        const updated = resp.data.data;
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  lastWhatsappSentAt: updated?.lastWhatsappSentAt,
                  whatsappSentCount: updated?.whatsappSentCount,
                }
              : r,
          ),
        );
      }
    } catch {
      // Non-critical — the WhatsApp chat is already open regardless of
      // whether this tracking call succeeded.
    } finally {
      setSendingId(null);
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
        title="Interest Nudges"
        subtitle="Users who opened “I'm Interested” without confirming — one email + 5 daily pushes go out automatically; WhatsApp is a manual follow-up."
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search user or vehicle…"
              leftIcon={<Search className="h-4 w-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3 text-xs">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1.5 font-semibold transition',
                statusFilter === f.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Visited</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Pushes</th>
                <th className="px-4 py-3">Last WhatsApp</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      icon={MessageCircle}
                      title={
                        debouncedQuery.trim() || statusFilter !== 'ALL'
                          ? 'No matches'
                          : 'Nothing to nudge'
                      }
                      description={
                        debouncedQuery.trim() || statusFilter !== 'ALL'
                          ? 'Try clearing the search or status filter.'
                          : 'No one has opened "I\'m Interested" without confirming yet.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const waLink = buildWhatsAppLink(row);
                  const lastWhatsapp = formatDateTime(row.lastWhatsappSentAt);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 align-top">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {row.userName || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.userPhone || '—'}
                        </div>
                        {row.userEmail && (
                          <div className="text-xs text-slate-400">
                            {row.userEmail}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-700">
                          {row.vehicleModel || '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.vehiclePriceRange || '—'}
                        </div>
                        {row.used && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            <Tag className="h-3 w-3" />
                            Used
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {formatDateTime(row.visitedAt) || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.emailSentAt ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                            <Mail className="h-3.5 w-3.5" />
                            Sent
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">Pending</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-semibold text-slate-700">
                          {row.remindersSent || 0}/{MAX_REMINDERS}
                        </div>
                        {formatDateTime(row.lastReminderAt) && (
                          <div className="text-[11px] text-slate-400">
                            {formatDateTime(row.lastReminderAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {lastWhatsapp ? (
                          <>
                            <div className="text-xs text-slate-600">
                              {lastWhatsapp}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {row.whatsappSentCount || 1}x
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400">Never</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.convertedAt ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Converted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!waLink || sendingId === row.id}
                          loading={sendingId === row.id}
                          onClick={() => handleWhatsApp(row)}
                          title={waLink ? undefined : 'No phone number on file'}
                        >
                          <Send className="h-3.5 w-3.5" />
                          WhatsApp
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {loading
              ? 'Loading…'
              : meta.totalElements === 0
                ? 'No matches.'
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
