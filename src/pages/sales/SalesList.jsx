import { useEffect, useState } from 'react';
import {
  ChartLine,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import {
  Leads as LeadsApi,
  Sales as SalesApi,
  Users as UsersApi,
  Vehicles as VehiclesApi,
} from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext';
import {
  EMPTY_SALE_FORM,
  SaleFields,
  saleBodyFromForm,
} from '@/components/sales/SaleFormShared.jsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'createdAt', label: 'Created' },
  { value: 'saleDate', label: 'Sale date' },
  { value: 'salePrice', label: 'Price' },
];

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

// Backend's Sales.getLeads returns the raw Spring Data Page (different keys
// than our custom DTOs use elsewhere). Read both shapes to be safe.
function readPageMeta(payload, fallbackPage) {
  const totalPages = payload?.totalPages ?? 0;
  const pageNumber =
    payload?.pageNumber ?? payload?.number ?? fallbackPage;
  const lastPage =
    payload?.lastPage ??
    payload?.LastPage ??
    payload?.last ??
    pageNumber >= Math.max(0, totalPages - 1);
  return {
    pageNumber,
    totalPages,
    totalElements: payload?.totalElements ?? 0,
    lastPage,
  };
}

export default function SalesList() {
  const { user, isSuperAdmin } = useAuth();
  const adminID = user?.id;

  const [sales, setSales] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    SalesApi.getAll({ page, size: pageSize, sortBy, sortDir })
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') {
          const payload = resp.data.data;
          setSales(payload?.content || []);
          setMeta(readPageMeta(payload, page));
          setError('');
        } else if (status === 'EMPTY') {
          setSales([]);
          setMeta({
            pageNumber: page,
            totalPages: 0,
            totalElements: 0,
            lastPage: true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load sales.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load sales.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  const showingFrom =
    meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0
      ? 0
      : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  const adminGuardError = !adminID
    ? 'Loading admin session… record-sale disabled until login data is available.'
    : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        subtitle={
          isSuperAdmin
            ? 'Closed sales recorded against converted leads.'
            : 'Your branch’s recorded sales. To record one, open the lead on the Leads page and use "Record sale".'
        }
        actions={
          // The walk-in flow needs the admin-only user/vehicle search
          // endpoints, so it's super-admin only. Staff record sales from
          // the lead itself on the Leads page.
          isSuperAdmin && (
            <Button onClick={() => setAddOpen(true)} disabled={!adminID}>
              <Plus className="h-4 w-4" />
              Record sale
            </Button>
          )
        }
      />

      {(error || adminGuardError) && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error || adminGuardError}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-end">
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
                <th className="px-4 py-3">Sale</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Sale date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <EmptyState
                      icon={ChartLine}
                      title="No sales recorded"
                      description="Record a sale once a lead converts and the buyer takes delivery."
                      action={
                        <Button
                          onClick={() => setAddOpen(true)}
                          disabled={!adminID}
                        >
                          <Plus className="h-4 w-4" />
                          Record sale
                        </Button>
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        #{s.id}
                      </div>
                      {s.invoiceNumber && (
                        <div className="text-xs text-slate-500">
                          Inv: {s.invoiceNumber}
                        </div>
                      )}
                      {s.salesperson?.name && (
                        <div className="text-[11px] text-slate-400">
                          by {s.salesperson.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-700">
                        {s.user?.name || '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {s.user?.phone || s.user?.email || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-700">
                        {s.vehicle?.model || '—'}
                      </div>
                      {s.vehicleNumber && (
                        <div className="text-xs text-slate-500">
                          {s.vehicleNumber}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        {s.salePrice ?? '—'}
                      </div>
                      {Number(s.earned) > 0 && (
                        <div className="text-xs text-emerald-700">
                          earned {s.earned}
                          {s.execCommission != null &&
                            ` · exec cut ${s.execCommission}`}
                        </div>
                      )}
                      {s.paymentMethod && (
                        <div className="text-[11px] text-slate-400">
                          {s.paymentMethod}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <PaymentBadge status={s.paymentStatus} />
                      {s.saleStatus && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {s.saleStatus}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {formatDate(s.saleDate)}
                      {s.deliveryDate && (
                        <div className="text-slate-400">
                          delivery {formatDate(s.deliveryDate)}
                        </div>
                      )}
                      <div className="text-slate-400">
                        upd {formatDateTime(s.updatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditTarget(s)}
                          disabled={!adminID}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
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
                ? 'No sales.'
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

      <AddSaleModal
        open={addOpen}
        adminID={adminID}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          reloadAll();
        }}
      />
      <EditSaleModal
        sale={editTarget}
        adminID={adminID}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          reloadAll();
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Add sale — full SaleDTO with user picker + vehicle picker.
// -----------------------------------------------------------------------------
function AddSaleModal({ open, adminID, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_SALE_FORM);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [matchedLead, setMatchedLead] = useState(null);
  const [linkLead, setLinkLead] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_SALE_FORM);
    setSelectedUser(null);
    setSelectedVehicle(null);
    setMatchedLead(null);
    setLinkLead(true);
    setSubmitting(false);
    setServerError('');
  }, [open]);

  // When customer + vehicle are picked, look for their open lead so the sale
  // closes the pipeline instead of leaving an orphan WON-less lead.
  useEffect(() => {
    setMatchedLead(null);
    if (!selectedUser || !selectedVehicle) return;
    let cancelled = false;
    LeadsApi.getAll({
      page: 0,
      size: 50,
      sortBy: 'time',
      sortDir: 'desc',
      q: selectedUser.email || selectedUser.phone || selectedUser.name,
    })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status !== 'SUCCESS') return;
        const match = (resp.data.data?.content || []).find(
          (l) =>
            l.user?.id === selectedUser.id &&
            l.vehicle?.id === selectedVehicle.id &&
            (l.status || '').toUpperCase() !== 'WON',
        );
        if (match) {
          setMatchedLead(match);
          setLinkLead(true);
        }
      })
      .catch(() => {
        // Lead lookup is best-effort — the sale can be recorded without it.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUser, selectedVehicle]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  const canSubmit =
    selectedUser &&
    selectedVehicle &&
    form.salePrice.trim() !== '' &&
    !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || !adminID) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        adminID,
        userID: selectedUser.id,
        vehicleID: selectedVehicle.id,
        // Linking transitions the lead to WON server-side.
        leadID: linkLead && matchedLead ? matchedLead.interestID : null,
        // Backend SaleDTO uses LocalDate / BigDecimal / String.
        ...saleBodyFromForm(form),
      };
      const resp = await SalesApi.add(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to record sale.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to record sale.',
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
      size="lg"
      title="Record sale"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-sale-form"
            loading={submitting}
            disabled={!canSubmit}
          >
            Record sale
          </Button>
        </>
      }
    >
      <form id="add-sale-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Customer *</Label>
            <UserPicker
              selected={selectedUser}
              onChange={setSelectedUser}
              placeholder="Search users by name, email, or phone…"
            />
          </div>
          <div>
            <Label>Vehicle *</Label>
            <VehiclePicker
              selected={selectedVehicle}
              onChange={setSelectedVehicle}
              placeholder="Search active vehicles…"
            />
          </div>
        </div>

        {matchedLead && (
          <label className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-800">
            <input
              type="checkbox"
              checked={linkLead}
              onChange={(e) => setLinkLead(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="font-semibold">
                Open lead found (#{matchedLead.interestID},{' '}
                {(matchedLead.status || 'NEW').replace('_', ' ')})
              </span>{' '}
              — link this sale to it and mark the lead WON.
            </span>
          </label>
        )}

        <SaleFields form={form} patch={patch} />

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
// Edit sale — UpdateSaleDTO (no IDs, all sale fields).
// -----------------------------------------------------------------------------
function EditSaleModal({ sale, adminID, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_SALE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = sale !== null;

  useEffect(() => {
    if (!open) return;
    setForm({
      saleDate: sale.saleDate || '',
      deliveryDate: sale.deliveryDate || '',
      salePrice: sale.salePrice != null ? String(sale.salePrice) : '',
      paymentMethod: sale.paymentMethod || '',
      paymentStatus: sale.paymentStatus || 'Pending',
      transactionId: sale.transactionId || '',
      saleStatus: sale.saleStatus || 'Completed',
      invoiceNumber: sale.invoiceNumber || '',
      notes: sale.notes || '',
      earned: sale.earned != null ? String(sale.earned) : '',
      vehicleNumber: sale.vehicleNumber || '',
      chesisNumber: sale.chesisNumber || '',
    });
    setSubmitting(false);
    setServerError('');
  }, [open, sale?.id]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sale || !adminID) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = saleBodyFromForm(form);
      const resp = await SalesApi.update(adminID, sale.id, body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update sale.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to update sale.',
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
      size="lg"
      title={`Edit sale #${sale.id}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-sale-form"
            loading={submitting}
            disabled={submitting}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-sale-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">
            {sale.user?.name} · {sale.vehicle?.model}
          </div>
          <div className="text-slate-500">
            Customer + vehicle aren't editable here — they're locked once the
            sale is recorded.
          </div>
        </div>
        <SaleFields form={form} patch={patch} />
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
// Pickers — debounced server-side search via the existing Users / Vehicles
// endpoints. Returns whichever entity was clicked (with id).
// -----------------------------------------------------------------------------
function UserPicker({ selected, onChange, placeholder }) {
  return (
    <SearchPicker
      selected={selected}
      onChange={onChange}
      placeholder={placeholder}
      fetchPage={(q) =>
        UsersApi.getAll({
          page: 0,
          size: 25,
          sortBy: 'name',
          sortDir: 'asc',
          q: q || undefined,
        })
      }
      renderSelected={(u) => (
        <>
          <div className="font-semibold text-brand-800">{u.name || '—'}</div>
          <div className="text-xs text-brand-700">
            {[u.email, u.phone].filter(Boolean).join(' · ')}
          </div>
        </>
      )}
      renderOption={(u) => (
        <>
          <div className="truncate font-medium text-slate-900">
            {u.name || '—'}
          </div>
          <div className="truncate text-xs text-slate-500">
            {[u.email, u.phone, u.role].filter(Boolean).join(' · ')}
          </div>
        </>
      )}
    />
  );
}

function VehiclePicker({ selected, onChange, placeholder }) {
  return (
    <SearchPicker
      selected={selected}
      onChange={onChange}
      placeholder={placeholder}
      fetchPage={(q) =>
        VehiclesApi.getAll({
          page: 0,
          size: 25,
          sortBy: 'model',
          sortDir: 'asc',
          q: q || undefined,
          status: 1,
        })
      }
      renderSelected={(v) => (
        <>
          <div className="font-semibold text-brand-800">{v.model}</div>
          <div className="text-xs text-brand-700">
            {[v.variant, v.color, v.brand?.name].filter(Boolean).join(' · ')}
          </div>
        </>
      )}
      renderOption={(v) => (
        <>
          <div className="truncate font-medium text-slate-900">{v.model}</div>
          <div className="truncate text-xs text-slate-500">
            {[v.variant, v.color, v.brand?.name].filter(Boolean).join(' · ')}
          </div>
        </>
      )}
    />
  );
}

function SearchPicker({
  selected,
  onChange,
  placeholder,
  fetchPage,
  renderSelected,
  renderOption,
}) {
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (selected) return; // skip the search while a selection is held
    let cancelled = false;
    setSearching(true);
    fetchPage(debouncedQuery.trim())
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') setResults(resp.data.data?.content || []);
        else setResults([]);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selected]);

  if (selected) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">{renderSelected(selected)}</div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="-m-1 rounded-md p-1 text-brand-700 transition hover:bg-white/60"
            title="Change"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        leftIcon={<Search className="h-4 w-4" />}
        placeholder={placeholder}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
        {searching ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : results.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            {debouncedQuery.trim() ? 'No matches.' : 'Type to search.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange(item)}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  {renderOption(item)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

function PaymentBadge({ status }) {
  const s = (status || '').toLowerCase();
  const tone =
    s === 'paid'
      ? 'bg-emerald-50 text-emerald-700'
      : s === 'pending'
        ? 'bg-amber-50 text-amber-700'
        : s === 'refunded' || s === 'failed'
          ? 'bg-red-50 text-red-700'
          : 'bg-slate-50 text-slate-500';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone,
      )}
    >
      {status || '—'}
    </span>
  );
}
