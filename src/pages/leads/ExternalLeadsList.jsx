import { useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Mail,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { ExternalLeads as ExtLeadsApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext';
import { cn } from '@/lib/cn';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'priority', label: 'Priority' },
];

const LEAD_STATUSES = ['NEW', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'];
const LEAD_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFormatter.format(d);
}
function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormatter.format(d);
}

// HTML <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" in local time.
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

export default function ExternalLeadsList() {
  const { user } = useAuth();
  const adminID = user?.id;

  const [leads, setLeads] = useState([]);
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
  const [reloadKey, setReloadKey] = useState(0);
  const [mutatingId, setMutatingId] = useState(null);

  const [editTarget, setEditTarget] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  // Reset to page 0 on filter change.
  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ExtLeadsApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
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
          throw new Error(resp?.data?.msg || 'Failed to load external leads.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load external leads.',
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

  async function handleRevive(lead) {
    if (!adminID) return;
    const ok = window.confirm(
      `Revive cancelled lead from ${lead.clientName || 'this client'}? It moves back to NEW.`,
    );
    if (!ok) return;
    setMutatingId(lead.id);
    setError('');
    try {
      const resp = await ExtLeadsApi.alive(adminID, lead.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to revive lead.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to revive lead.',
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function handleHardDelete(lead) {
    if (!adminID) return;
    const ok = window.confirm(
      `Permanently delete this lead from the DB? This can't be undone.\n\nClient: ${lead.clientName}\nPhone: ${lead.phoneNumber}`,
    );
    if (!ok) return;
    setMutatingId(lead.id);
    setError('');
    try {
      const resp = await ExtLeadsApi.removeFromDB(adminID, lead.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to remove lead from DB.');
      }
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to remove lead from DB.',
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

  const adminGuardError = !adminID
    ? 'Loading admin session… actions disabled until login data is available.'
    : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="External Leads"
        subtitle="Leads ingested from partner channels and offline sources."
      />

      {(error || adminGuardError) && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error || adminGuardError}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { value: 'all', label: 'All' },
              ...LEAD_STATUSES.map((s) => ({
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
                setPageSize(Number(v));
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
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Earnings</th>
                <th className="px-4 py-3">Updated</th>
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
                      icon={ClipboardList}
                      title={
                        statusFilter !== 'all'
                          ? 'No leads match this status'
                          : 'No external leads yet'
                      }
                      description={
                        statusFilter !== 'all'
                          ? 'Try clearing the status filter.'
                          : 'Leads from partner channels appear here as they come in.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="align-top hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        {lead.clientName || '—'}
                      </div>
                      {lead.phoneNumber && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {lead.phoneNumber}
                        </div>
                      )}
                      {lead.altPhoneNumber && (
                        <div className="text-xs text-slate-400">
                          alt: {lead.altPhoneNumber}
                        </div>
                      )}
                      {lead.city && (
                        <div className="text-xs text-slate-400">{lead.city}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {lead.vehicle || '—'}
                      {lead.financeInterest && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Finance: {lead.financeInterest}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {lead.leadProviderName || '—'}
                      {lead.leadProviderID && (
                        <div className="text-slate-400">
                          #{lead.leadProviderID}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <LeadStatusBadge status={lead.status} />
                      {lead.status === 'CLOSED' && lead.paymentStatus && (
                        <div className="mt-1">
                          <PaymentBadge status={lead.paymentStatus} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={lead.priority} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {lead.expectedEarnings != null && (
                        <div>
                          <span className="text-slate-400">Exp:</span>{' '}
                          {lead.expectedEarnings}
                        </div>
                      )}
                      {lead.earned != null && Number(lead.earned) > 0 && (
                        <div className="text-emerald-700">
                          Earned: {lead.earned}
                        </div>
                      )}
                      {lead.partnersTake != null &&
                        Number(lead.partnersTake) > 0 && (
                          <div className="text-slate-500">
                            Take: {lead.partnersTake}
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {formatDate(lead.updated)}
                      {lead.nextFollowUp && (
                        <div className="text-slate-400">
                          F/U: {formatDateTime(lead.nextFollowUp)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <RowActions
                        lead={lead}
                        adminID={adminID}
                        mutating={mutatingId === lead.id}
                        anyMutating={mutatingId !== null}
                        onEdit={() => setEditTarget(lead)}
                        onClose={() => setCloseTarget(lead)}
                        onCancel={() => setCancelTarget(lead)}
                        onRevive={() => handleRevive(lead)}
                        onHardDelete={() => handleHardDelete(lead)}
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
                ? 'No leads.'
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
        lead={editTarget}
        adminID={adminID}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          reloadAll();
        }}
      />
      <CloseLeadModal
        lead={closeTarget}
        adminID={adminID}
        onClose={() => setCloseTarget(null)}
        onSaved={() => {
          setCloseTarget(null);
          reloadAll();
        }}
      />
      <CancelLeadModal
        lead={cancelTarget}
        adminID={adminID}
        onClose={() => setCancelTarget(null)}
        onSaved={() => {
          setCancelTarget(null);
          reloadAll();
        }}
      />
    </div>
  );
}

function RowActions({
  lead,
  adminID,
  mutating,
  anyMutating,
  onEdit,
  onClose,
  onCancel,
  onRevive,
  onHardDelete,
}) {
  const status = lead.status;
  const isOpen = status === 'NEW' || status === 'IN_PROGRESS';
  const isCancelled = status === 'CANCELLED';
  const isClosed = status === 'CLOSED';

  return (
    <div className="flex items-center justify-end gap-1.5">
      {/* Edit — available unless lead is closed (closed leads use the Close modal's data) */}
      {!isClosed && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onEdit}
          disabled={!adminID || anyMutating}
          title="Edit working notes"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {/* Close — only for open leads */}
      {isOpen && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onClose}
          disabled={!adminID || anyMutating}
          className="text-emerald-700 hover:bg-emerald-50"
          title="Close (record payment)"
        >
          <Wallet className="h-3.5 w-3.5" />
          Close
        </Button>
      )}
      {/* Cancel (soft) — only for open leads */}
      {isOpen && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onCancel}
          disabled={!adminID || anyMutating}
          className="text-amber-700 hover:bg-amber-50"
          title="Cancel lead"
        >
          <Ban className="h-3.5 w-3.5" />
        </Button>
      )}
      {/* Revive — only for cancelled */}
      {isCancelled && (
        <Button
          size="sm"
          variant="secondary"
          loading={mutating}
          disabled={!adminID || anyMutating}
          onClick={onRevive}
          className="text-emerald-700 hover:bg-emerald-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Revive
        </Button>
      )}
      {/* Hard delete — only for already-cancelled (last-resort cleanup) */}
      {isCancelled && (
        <Button
          size="sm"
          variant="secondary"
          loading={mutating}
          disabled={!adminID || anyMutating}
          onClick={onHardDelete}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          title="Permanently delete from DB"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Edit modal — LeadAdminUpdateRequest
// -----------------------------------------------------------------------------
function EditLeadModal({ lead, adminID, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = lead !== null;

  useEffect(() => {
    if (!open) {
      setForm(null);
      return;
    }
    setForm({
      noteVisibleToPartner: lead.noteVisibleToPartner ?? '',
      interested: Boolean(lead.interested),
      expectedEarnings:
        lead.expectedEarnings != null ? String(lead.expectedEarnings) : '',
      didAdminCalled: Boolean(lead.didAdminCalled),
      didUserAnswered: Boolean(lead.didUserAnswered),
      lastCallTime: toLocalInputValue(lead.lastCallTime),
      adminInternalNote: lead.adminInternalNote ?? '',
      priority: LEAD_PRIORITIES.includes(lead.priority)
        ? lead.priority
        : 'MEDIUM',
      nextFollowUp: toLocalInputValue(lead.nextFollowUp),
    });
    setServerError('');
    setSubmitting(false);
  }, [open, lead?.id]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lead || !form || !adminID) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        leadID: lead.id,
        noteVisibleToPartner: form.noteVisibleToPartner,
        interested: form.interested,
        // Backend takes BigDecimal; sending as string is fine. Empty → null.
        expectedEarnings:
          form.expectedEarnings.trim() === '' ? null : form.expectedEarnings.trim(),
        didAdminCalled: form.didAdminCalled,
        didUserAnswered: form.didAdminCalled ? form.didUserAnswered : false,
        lastCallTime: form.lastCallTime ? form.lastCallTime + ':00' : null,
        adminInternalNote: form.adminInternalNote,
        priority: form.priority,
        nextFollowUp: form.nextFollowUp ? form.nextFollowUp + ':00' : null,
      };
      const resp = await ExtLeadsApi.update(adminID, body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update lead.');
      }
      onSaved();
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
      title={`Edit lead — ${lead.clientName || `#${lead.id}`}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-extlead-form"
            loading={submitting}
            disabled={submitting}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="edit-extlead-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">{lead.vehicle}</div>
          <div>{lead.phoneNumber || '—'}</div>
          {lead.partnerSubmittedNote && (
            <div className="mt-1 italic text-slate-500">
              Partner note: “{lead.partnerSubmittedNote}”
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onChange={(v) => patch({ priority: v })}
              options={LEAD_PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <div>
            <Label>Expected earnings</Label>
            <Input
              value={form.expectedEarnings}
              onChange={(e) => patch({ expectedEarnings: e.target.value })}
              placeholder="e.g. 12000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CheckboxRow
            label="User is interested"
            checked={form.interested}
            onChange={(v) => patch({ interested: v })}
          />
          <CheckboxRow
            label="Admin called"
            checked={form.didAdminCalled}
            onChange={(v) =>
              patch({
                didAdminCalled: v,
                didUserAnswered: v ? form.didUserAnswered : false,
              })
            }
          />
          <CheckboxRow
            label="User answered"
            checked={form.didUserAnswered}
            onChange={(v) => patch({ didUserAnswered: v })}
            disabled={!form.didAdminCalled}
          />
          <div>
            <Label>Last call time</Label>
            <input
              type="datetime-local"
              value={form.lastCallTime}
              onChange={(e) => patch({ lastCallTime: e.target.value })}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        <div>
          <Label>Next follow-up</Label>
          <input
            type="datetime-local"
            value={form.nextFollowUp}
            onChange={(e) => patch({ nextFollowUp: e.target.value })}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <Label>Note visible to partner</Label>
          <textarea
            rows={2}
            value={form.noteVisibleToPartner}
            onChange={(e) => patch({ noteVisibleToPartner: e.target.value })}
            placeholder="Status update the partner will see…"
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <Label>Admin internal note</Label>
          <textarea
            rows={2}
            value={form.adminInternalNote}
            onChange={(e) => patch({ adminInternalNote: e.target.value })}
            placeholder="Private to admins. Not shown to partner."
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

// -----------------------------------------------------------------------------
// Close modal — LeadAdminCloseRequest
// -----------------------------------------------------------------------------
function CloseLeadModal({ lead, adminID, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = lead !== null;

  useEffect(() => {
    if (!open) {
      setForm(null);
      return;
    }
    setForm({
      paymentStatus: 'PENDING',
      takePaidAmount:
        lead.takePaidAmount != null ? String(lead.takePaidAmount) : '',
      txnID: lead.txnID ?? '',
      partnersTake:
        lead.partnersTake != null ? String(lead.partnersTake) : '',
      totalEarning: lead.earned != null ? String(lead.earned) : '',
    });
    setServerError('');
    setSubmitting(false);
  }, [open, lead?.id]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lead || !form || !adminID) return;
    if (!form.totalEarning.trim()) {
      setServerError('Total earning is required to close a lead.');
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        leadID: lead.id,
        paymentStatus: form.paymentStatus,
        takePaidAmount:
          form.takePaidAmount.trim() === '' ? null : form.takePaidAmount.trim(),
        txnID: form.txnID.trim() || null,
        partnersTake:
          form.partnersTake.trim() === '' ? null : form.partnersTake.trim(),
        totalEarning: form.totalEarning.trim(),
      };
      const resp = await ExtLeadsApi.close(adminID, body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to close lead.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to close lead.',
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
      size="md"
      title={`Close lead — ${lead.clientName || `#${lead.id}`}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="close-extlead-form"
            loading={submitting}
            disabled={submitting || !form.totalEarning.trim()}
          >
            Close lead
          </Button>
        </>
      }
    >
      <form
        id="close-extlead-form"
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
          Recording the sale closes this lead. Payment status defaults to
          PENDING — switch to PAID once the partner has been paid out.
        </div>
        <div>
          <Label>Total earning *</Label>
          <Input
            value={form.totalEarning}
            onChange={(e) => patch({ totalEarning: e.target.value })}
            placeholder="e.g. 12000"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Partner's take</Label>
            <Input
              value={form.partnersTake}
              onChange={(e) => patch({ partnersTake: e.target.value })}
              placeholder="e.g. 1500"
            />
          </div>
          <div>
            <Label>Take paid amount</Label>
            <Input
              value={form.takePaidAmount}
              onChange={(e) => patch({ takePaidAmount: e.target.value })}
              placeholder="0 if not yet paid"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Payment status</Label>
            <Select
              value={form.paymentStatus}
              onChange={(v) => patch({ paymentStatus: v })}
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <Label>Transaction ID</Label>
            <Input
              value={form.txnID}
              onChange={(e) => patch({ txnID: e.target.value })}
              placeholder="UPI / bank ref"
            />
          </div>
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

// -----------------------------------------------------------------------------
// Cancel (soft) modal — backend body needs leadID + reason + noteForPrt.
// -----------------------------------------------------------------------------
function CancelLeadModal({ lead, adminID, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [noteForPrt, setNoteForPrt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = lead !== null;

  useEffect(() => {
    if (!open) return;
    setReason('');
    setNoteForPrt('');
    setSubmitting(false);
    setServerError('');
  }, [open, lead?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lead || !adminID) return;
    if (!reason.trim() || !noteForPrt.trim()) {
      setServerError('Both reason and partner note are required.');
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        leadID: String(lead.id),
        reason: reason.trim(),
        noteForPrt: noteForPrt.trim(),
      };
      const resp = await ExtLeadsApi.delete(adminID, body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to cancel lead.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to cancel lead.',
      );
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title={`Cancel lead — ${lead.clientName || `#${lead.id}`}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Keep open
          </Button>
          <Button
            type="submit"
            form="cancel-extlead-form"
            loading={submitting}
            disabled={submitting || !reason.trim() || !noteForPrt.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Cancel lead
          </Button>
        </>
      }
    >
      <form
        id="cancel-extlead-form"
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
          Cancelling moves this lead to CANCELLED status. It can be revived
          later if needed.
        </div>
        <div>
          <Label>Internal reason</Label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are we cancelling this lead?"
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <Label>Note for partner</Label>
          <textarea
            rows={2}
            value={noteForPrt}
            onChange={(e) => setNoteForPrt(e.target.value)}
            placeholder="What the partner sees in the cancellation notice."
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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

function Select({ value, onChange, options }) {
  return (
    <select
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

function CheckboxRow({ label, checked, onChange, disabled }) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
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

function LeadStatusBadge({ status }) {
  const s = (status || 'NEW').toUpperCase();
  const map = {
    NEW: { tone: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
    IN_PROGRESS: { tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    CLOSED: { tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    CANCELLED: { tone: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
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
  const p = (priority || 'MEDIUM').toUpperCase();
  const tone =
    p === 'HIGH'
      ? 'bg-red-50 text-red-700'
      : p === 'LOW'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-amber-50 text-amber-700';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone,
      )}
    >
      {p}
    </span>
  );
}

function PaymentBadge({ status }) {
  const s = (status || 'PENDING').toUpperCase();
  const tone =
    s === 'PAID'
      ? 'bg-emerald-50 text-emerald-700'
      : s === 'FAILED'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-700';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        tone,
      )}
    >
      {s}
    </span>
  );
}
