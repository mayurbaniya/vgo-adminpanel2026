import { useEffect, useState } from 'react';
import {
  BadgePercent,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Phone,
  PhoneOff,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Leads as LeadsApi, Offers as OffersApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import { RecordSaleFromLeadModal } from '@/components/sales/SaleFormShared.jsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'time', label: 'Created' },
  { value: 'lastCallTime', label: 'Last call' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
];

// Mirrors the backend LeadStage enum + its transition map. The select in the
// edit modal only offers legal moves; the backend re-validates anyway.
const LEAD_STAGES = [
  'NEW',
  'ASSIGNED',
  'CONTACTED',
  'TEST_RIDE',
  'NEGOTIATION',
  'BOOKED',
  'WON',
  'LOST',
];
// WON is not offered anywhere: a lead becomes WON only by recording its sale
// (the "Record sale" action), which is what keeps every WON traceable to a
// sale record. The backend rejects manual WON moves too.
const STAGE_TRANSITIONS = {
  NEW: ['ASSIGNED', 'CONTACTED', 'LOST'],
  ASSIGNED: ['CONTACTED', 'LOST'],
  CONTACTED: ['TEST_RIDE', 'NEGOTIATION', 'BOOKED', 'LOST'],
  TEST_RIDE: ['NEGOTIATION', 'BOOKED', 'LOST'],
  NEGOTIATION: ['BOOKED', 'LOST'],
  BOOKED: ['LOST'],
  WON: [],
  LOST: ['CONTACTED'],
};
// Legacy values still stored on old rows — same mapping LeadStage.parse uses.
const LEGACY_STAGE_MAP = {
  ONGOING: 'CONTACTED',
  IN_PROGRESS: 'CONTACTED',
  CLOSED: 'LOST',
  CANCELLED: 'LOST',
  DELETED: 'LOST',
};
function normalizeStage(raw) {
  const v = (raw || 'NEW').toUpperCase();
  if (LEAD_STAGES.includes(v)) return v;
  return LEGACY_STAGE_MAP[v] || 'NEW';
}

const LEAD_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW']; // matches LeadPriority enum

// Backend stores priority as int on the Interest entity
// (1=HIGH, 2=MEDIUM, 3=LOW) and projects it back through InterestResponse.
// The /update endpoint expects the LeadPriority enum string.
function priorityIntToEnum(n) {
  if (n === 1) return 'HIGH';
  if (n === 3) return 'LOW';
  return 'MEDIUM';
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
}
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
}

// HTML <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" in the local
// timezone. Server values are ISO-ish; trim seconds/timezone for the input.
function toLocalInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function LeadsList() {
  const { user } = useAuth();
  const isExec = user?.scopeType === 'DEALERSHIP';
  // Lifecycle trail is manager/admin territory; execs just work the lead.
  const canViewHistory = !isExec;
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('time');
  const [sortDir, setSortDir] = useState('desc');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | NEW | IN_PROGRESS | CLOSED | CANCELLED
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saleLead, setSaleLead] = useState(null);
  const [historyLead, setHistoryLead] = useState(null);

  // Reset to page 0 whenever search or status filter changes.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    LeadsApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      q: debouncedQuery.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    })
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') {
          const payload = resp.data.data;
          const totalPages = payload?.totalPages ?? 0;
          const pageNumber = payload?.pageNumber ?? page;
          const lastPage =
            payload?.lastPage ??
            payload?.LastPage ??
            pageNumber >= Math.max(0, totalPages - 1);
          setLeads(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else if (status === 'EMPTY') {
          setLeads([]);
          setMeta({
            pageNumber: page,
            totalPages: 0,
            totalElements: 0,
            lastPage: true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load leads.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load leads.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, statusFilter]);

  const showingFrom =
    meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0
      ? 0
      : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="In-app leads from the Wheely consumer flow."
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
              placeholder="Search user, vehicle, or notes…"
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

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 text-xs">
          {[
            { value: 'all', label: 'All' },
            ...LEAD_STAGES.map((s) => ({
              value: s,
              label: s.replace('_', ' '),
            })),
          ].map((opt) => (
            <FilterPill
              key={opt.value}
              active={statusFilter === opt.value}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </FilterPill>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Branch / Assignee</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Called</th>
                <th className="px-4 py-3">Created</th>
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
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      icon={Sparkles}
                      title={
                        debouncedQuery.trim() || statusFilter !== 'all'
                          ? 'No leads match your filters'
                          : 'No leads yet'
                      }
                      description={
                        debouncedQuery.trim() || statusFilter !== 'all'
                          ? 'Try clearing the search or status filter.'
                          : 'No in-app leads have been submitted yet.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.interestID} className="hover:bg-slate-50/50 align-top">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        {lead.user?.name || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {lead.user?.phone || lead.user?.email || '—'}
                      </div>
                      {lead.notes && (
                        <div
                          className="mt-1 max-w-xs truncate text-xs italic text-slate-400"
                          title={lead.notes}
                        >
                          “{lead.notes}”
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-700">
                        {lead.vehicle?.model || '—'}
                      </div>
                      {lead.interested ? (
                        <div className="text-xs text-emerald-600">
                          Interested
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Not interested
                        </div>
                      )}
                      {lead.offerTitle && (
                        <div
                          className="mt-1 inline-flex max-w-[180px] items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700"
                          title={`Lead came from offer: ${lead.offerTitle}`}
                        >
                          <BadgePercent className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lead.offerTitle}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <LeadStatusBadge status={lead.status} />
                      {normalizeStage(lead.status) === 'LOST' && lead.lostReason && (
                        <div
                          className="mt-1 max-w-[160px] truncate text-[11px] text-slate-400"
                          title={lead.lostReason}
                        >
                          {lead.lostReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-700">
                        {lead.dealershipName || (
                          <span className="text-slate-400">Unrouted</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {lead.cityName || '—'}
                        {lead.assignedToName ? ` · ${lead.assignedToName}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={lead.priority} />
                    </td>
                    <td className="px-4 py-3.5">
                      <CallStatus
                        called={lead.didAdminCalled}
                        answered={lead.didUserAnswered}
                        lastCallTime={lead.lastCallTime}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(lead.time)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-2">
                        {normalizeStage(lead.status) !== 'WON' && (
                          <Button
                            size="sm"
                            onClick={() => setSaleLead(lead)}
                          >
                            Record sale
                          </Button>
                        )}
                        {/* A WON deal is done — execs can't reopen or edit it. */}
                        {!(isExec && normalizeStage(lead.status) === 'WON') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditing(lead)}
                          >
                            Edit
                          </Button>
                        )}
                        {canViewHistory && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHistoryLead(lead)}
                          >
                            History
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
                ? debouncedQuery.trim() || statusFilter !== 'all'
                  ? 'No matches.'
                  : 'No leads.'
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

      <EditLeadModal
        lead={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setLeads((prev) =>
            prev.map((l) =>
              l.interestID === updated.interestID ? { ...l, ...updated } : l,
            ),
          );
          setEditing(null);
        }}
      />

      <LeadHistoryModal
        lead={historyLead}
        onClose={() => setHistoryLead(null)}
      />

      <RecordSaleFromLeadModal
        lead={saleLead}
        onClose={() => setSaleLead(null)}
        onSaved={() => {
          // The backend moved the lead to WON alongside the sale.
          setLeads((prev) =>
            prev.map((l) =>
              l.interestID === saleLead?.interestID
                ? { ...l, status: 'WON' }
                : l,
            ),
          );
          setSaleLead(null);
        }}
      />
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 font-semibold transition',
        active
          ? 'border-brand-200 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
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

function LeadStatusBadge({ status }) {
  const s = normalizeStage(status);
  const map = {
    NEW: { tone: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
    ASSIGNED: { tone: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
    CONTACTED: { tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    TEST_RIDE: { tone: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
    NEGOTIATION: { tone: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
    BOOKED: { tone: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
    WON: { tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    LOST: { tone: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  };
  const cfg = map[s] || { tone: 'bg-slate-50 text-slate-500', dot: 'bg-slate-300' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        cfg.tone,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {s.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const enumName = priorityIntToEnum(priority);
  const tone =
    enumName === 'HIGH'
      ? 'bg-red-50 text-red-700'
      : enumName === 'LOW'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-amber-50 text-amber-700';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone,
      )}
    >
      {enumName}
    </span>
  );
}

function CallStatus({ called, answered, lastCallTime }) {
  if (!called) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <PhoneOff className="h-3 w-3" />
        Not called
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <Phone className="h-3 w-3 text-slate-400" />
        Called
        {answered && (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" title="Answered" />
        )}
      </div>
      {lastCallTime && (
        <div className="text-[11px] text-slate-400">
          {formatDateTime(lastCallTime)}
        </div>
      )}
    </div>
  );
}

// "Active offers on this vehicle" — shown in the lead editor regardless of
// how the lead arrived, so no customer conversation misses an applicable
// offer (covers vehicle-specific, brand-wide and app-wide offers).
function ActiveOffersStrip({ vehicleId }) {
  const [offers, setOffers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!vehicleId) {
      setOffers([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    OffersApi.activeForVehicle(vehicleId)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setOffers(resp.data.data || []);
        }
      })
      .catch(() => {
        // Non-critical chrome — a fetch failure just hides the strip.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  if (!loaded || offers.length === 0) return null;

  return (
    <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/60 px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider text-fuchsia-700">
        <BadgePercent className="h-3 w-3" />
        Active offers on this vehicle
      </div>
      <ul className="space-y-0.5 text-slate-700">
        {offers.map((o) => (
          <li key={o.id}>
            <span className="font-medium">{o.title}</span>
            {o.benefitText && (
              <span className="text-slate-500"> — {o.benefitText}</span>
            )}
            {!o.vehicle && (
              <span className="text-slate-400">
                {' '}
                ({o.brand ? 'brand-wide' : 'app-wide'})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditLeadModal({ lead, onClose, onSaved }) {
  const { user, isSuperAdmin } = useAuth();
  const canAssign = user?.scopeType !== 'DEALERSHIP';
  // Admin supervises rather than works leads: their editor is just stage,
  // priority, notes and assignment. The call-tracking fields belong to the
  // manager/exec actually making the calls (their current values are still
  // sent unchanged on save, so nothing gets wiped).
  const showWorkingFields = !isSuperAdmin;
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = lead !== null;
  const currentStage = lead ? normalizeStage(lead.status) : 'NEW';

  useEffect(() => {
    if (!lead) {
      setForm(null);
      setServerError('');
      setSubmitting(false);
      return;
    }
    setForm({
      interested: Boolean(lead.interested),
      status: normalizeStage(lead.status),
      priority: priorityIntToEnum(lead.priority),
      didAdminCalled: Boolean(lead.didAdminCalled),
      didUserAnswered: Boolean(lead.didUserAnswered),
      lastCallTime: toLocalInputValue(lead.lastCallTime),
      notes: lead.notes || '',
      lostReason: lead.lostReason || '',
      bookingAmount:
        lead.bookingAmount !== null && lead.bookingAmount !== undefined
          ? String(lead.bookingAmount)
          : '',
    });
    setServerError('');
    setSubmitting(false);
  }, [lead]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lead || !form) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        interestID: lead.interestID,
        interested: form.interested,
        status: form.status,
        didAdminCalled: form.didAdminCalled,
        // If admin didn't call, the user couldn't have answered.
        didUserAnswered: form.didAdminCalled ? form.didUserAnswered : false,
        lastCallTime: form.lastCallTime ? form.lastCallTime + ':00' : null,
        notes: form.notes,
        priority: form.priority,
        lostReason: form.status === 'LOST' ? form.lostReason.trim() : null,
        bookingAmount:
          form.status === 'BOOKED' && form.bookingAmount !== ''
            ? Number(form.bookingAmount)
            : null,
      };
      const resp = await LeadsApi.update(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update lead.');
      }
      const updated = resp.data.data;
      onSaved({
        interestID: lead.interestID,
        interested: updated?.interested ?? body.interested,
        status: updated?.status ?? body.status,
        didAdminCalled: updated?.didAdminCalled ?? body.didAdminCalled,
        didUserAnswered: updated?.didUserAnswered ?? body.didUserAnswered,
        lastCallTime: updated?.lastCallTime ?? body.lastCallTime,
        notes: updated?.notes ?? body.notes,
        priority: updated?.priority,
        lostReason: updated?.lostReason ?? body.lostReason,
        bookingAmount: updated?.bookingAmount ?? body.bookingAmount,
        bookedOn: updated?.bookedOn,
      });
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to update lead.',
      );
      setSubmitting(false);
    }
  }

  if (!open || !form) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      size="lg"
      title={`Edit lead — ${lead.user?.name || `#${lead.interestID}`}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-lead-form"
            loading={submitting}
            disabled={
              submitting ||
              (form.status === 'LOST' && !form.lostReason.trim())
            }
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-lead-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">
            {lead.vehicle?.model || 'Unknown vehicle'}
          </div>
          <div>
            {lead.user?.phone || '—'} · {lead.user?.email || '—'}
          </div>
          {lead.offerTitle && (
            <div className="mt-1 flex items-center gap-1 font-semibold text-fuchsia-700">
              <BadgePercent className="h-3 w-3" />
              Lead came from offer: {lead.offerTitle}
            </div>
          )}
        </div>

        <ActiveOffersStrip vehicleId={lead.vehicle?.id} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-status">Stage</Label>
            <SelectField
              id="lead-status"
              value={form.status}
              onChange={(v) => patch({ status: v })}
              options={[currentStage, ...(STAGE_TRANSITIONS[currentStage] || [])].map(
                (s) => ({
                  value: s,
                  label: s.replace('_', ' '),
                }),
              )}
            />
            {currentStage === 'WON' ? (
              <div className="mt-1 text-[11px] text-slate-400">
                WON is terminal — this lead has a recorded sale.
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">
                To close as WON, use the lead's "Record sale" button — the
                sale record moves it to WON automatically.
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="lead-priority">Priority</Label>
            <SelectField
              id="lead-priority"
              value={form.priority}
              onChange={(v) => patch({ priority: v })}
              options={LEAD_PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </div>

        {form.status === 'LOST' && (
          <div>
            <Label htmlFor="lead-lost-reason">Lost reason (required)</Label>
            <Input
              id="lead-lost-reason"
              placeholder="e.g. bought elsewhere, budget, no response…"
              value={form.lostReason}
              onChange={(e) => patch({ lostReason: e.target.value })}
              maxLength={160}
            />
          </div>
        )}

        {form.status === 'BOOKED' && (
          <div>
            <Label htmlFor="lead-booking-amount">Booking / token amount (₹)</Label>
            <Input
              id="lead-booking-amount"
              type="number"
              min="0"
              placeholder="e.g. 5000"
              value={form.bookingAmount}
              onChange={(e) => patch({ bookingAmount: e.target.value })}
            />
          </div>
        )}

        {canAssign && (
          <AssignSection lead={lead} onAssigned={onSaved} />
        )}

        {showWorkingFields && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CheckboxField
              id="lead-interested"
              label="User is interested"
              checked={form.interested}
              onChange={(v) => patch({ interested: v })}
            />
            <CheckboxField
              id="lead-called"
              label="Admin called"
              checked={form.didAdminCalled}
              onChange={(v) =>
                patch({
                  didAdminCalled: v,
                  // Reset answered when un-checking called — backend stores both
                  // independently but the combination "not called + answered"
                  // makes no sense.
                  didUserAnswered: v ? form.didUserAnswered : false,
                })
              }
            />
            <CheckboxField
              id="lead-answered"
              label="User answered"
              checked={form.didUserAnswered}
              onChange={(v) => patch({ didUserAnswered: v })}
              disabled={!form.didAdminCalled}
            />
            <div>
              <Label htmlFor="lead-last-call">Last call time</Label>
              <input
                id="lead-last-call"
                type="datetime-local"
                value={form.lastCallTime}
                onChange={(e) => patch({ lastCallTime: e.target.value })}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="lead-notes">Notes</Label>
          <textarea
            id="lead-notes"
            rows={4}
            value={form.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Working notes for the next call…"
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {serverError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}

// Complete lifecycle trail for one lead — every stage move, assignment, and
// the closing sale, newest first. Admin + city manager only (the button is
// hidden for execs and the backend rejects them too).
function LeadHistoryModal({ lead, onClose }) {
  const open = lead !== null;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    LeadsApi.events(lead.interestID)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setEvents(resp.data.data || []);
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load history.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load history.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, lead?.interestID]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Lead #${lead.interestID} history — ${lead.user?.name || ''}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-1 text-xs text-slate-500">
        <div>
          Created {formatDateTime(lead.time)} · {lead.vehicle?.model || '—'}
          {lead.cityName ? ` · ${lead.cityName}` : ''}
          {lead.dealershipName ? ` · ${lead.dealershipName}` : ''}
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
            No recorded activity yet — events start when the lead is assigned
            or its stage changes.
          </div>
        ) : (
          <ol className="relative ml-2 space-y-4 border-l border-slate-200 pl-4">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <LeadStatusBadge status={ev.fromStatus} />
                  <span className="text-slate-400">→</span>
                  <LeadStatusBadge status={ev.toStatus} />
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {ev.actor?.name || 'System'} · {formatDateTime(ev.created)}
                </div>
                {ev.note && (
                  <div className="mt-0.5 text-xs italic text-slate-600">
                    “{ev.note}”
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

// Assignment control inside the lead editor — visible to GLOBAL/CITY-scoped
// staff (backend rejects a DEALERSHIP-scoped actor anyway). Assigning routes
// the lead to the assignee's dealership and moves NEW → ASSIGNED.
function AssignSection({ lead, onAssigned }) {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    LeadsApi.assignableStaff()
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') setStaff(resp.data.data || []);
      })
      .catch(() => {
        // Non-critical — section just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelected(lead?.assignedToID ? String(lead.assignedToID) : '');
    setError('');
  }, [lead]);

  if (staff.length === 0) return null;

  async function handleAssign() {
    if (!selected) return;
    setAssigning(true);
    setError('');
    try {
      const resp = await LeadsApi.assign(lead.interestID, Number(selected));
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to assign lead.');
      }
      const updated = resp.data.data;
      onAssigned({
        interestID: lead.interestID,
        status: updated?.status,
        assignedToID: updated?.assignedToID,
        assignedToName: updated?.assignedToName,
        dealershipID: updated?.dealershipID,
        dealershipName: updated?.dealershipName,
        cityID: updated?.cityID,
        cityName: updated?.cityName,
      });
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to assign lead.');
      setAssigning(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <Label htmlFor="lead-assignee">Assign to</Label>
      <div className="flex gap-2">
        <select
          id="lead-assignee"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">Select a staff member…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} —{' '}
              {s.accessRole?.scopeType === 'DEALERSHIP'
                ? s.dealership?.name || 'no dealership'
                : `${s.staffCity?.name || '—'} (manager)`}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          loading={assigning}
          disabled={assigning || !selected || Number(selected) === lead?.assignedToID}
          onClick={handleAssign}
        >
          Assign
        </Button>
      </div>
      {error && (
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

function SelectField({ id, value, onChange, options }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxField({ id, label, checked, onChange, disabled }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}
