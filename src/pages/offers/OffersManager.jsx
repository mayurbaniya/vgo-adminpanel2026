import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import {
  Offers as OffersApi,
  Brands as BrandsApi,
  Cities as CitiesApi,
  Vehicles as VehiclesApi,
} from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

// offer.status.* from application.properties
const STATUS_ACTIVE = 1;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Matches backend OfferType enum. Tone drives the chip colour.
const OFFER_TYPES = [
  { value: 'DISCOUNT', label: 'Discount', tone: 'bg-emerald-50 text-emerald-700' },
  { value: 'EXCHANGE_BONUS', label: 'Exchange bonus', tone: 'bg-sky-50 text-sky-700' },
  { value: 'LOW_EMI', label: 'Low EMI', tone: 'bg-indigo-50 text-indigo-700' },
  { value: 'CASHBACK', label: 'Cashback', tone: 'bg-amber-50 text-amber-700' },
  { value: 'ACCESSORY', label: 'Free accessory', tone: 'bg-fuchsia-50 text-fuchsia-700' },
  { value: 'FESTIVE', label: 'Festive', tone: 'bg-rose-50 text-rose-700' },
];

const EMPTY_FORM = {
  title: '',
  benefitText: '',
  description: '',
  termsAndConditions: '',
  offerType: 'DISCOUNT',
  scope: 'GLOBAL', // GLOBAL | BRAND | VEHICLE — UI concept; backend gets brandId/vehicleId
  brandId: '',
  vehicleId: '',
  priority: 0,
  startsAt: '',
  endsAt: '',
  targetCityIds: [],
};

export default function OffersManager() {
  const [offers, setOffers] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('priority');
  const [sortDir, setSortDir] = useState('desc');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editorOffer, setEditorOffer] = useState(undefined); // undefined = closed, null = create, {...} = edit
  const [imageOffer, setImageOffer] = useState(null);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, typeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    OffersApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      q: debouncedQuery.trim() || undefined,
      offerType: typeFilter || undefined,
    })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          const payload = resp.data.data;
          setOffers(payload?.content || []);
          setMeta({
            pageNumber: payload?.pageNumber ?? page,
            totalPages: payload?.totalPages ?? 0,
            totalElements: payload?.totalElements ?? 0,
            lastPage: payload?.lastPage ?? payload?.LastPage ?? true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load offers.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load offers.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, typeFilter, reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function handleToggle(offer) {
    const goingToActive = offer.status !== STATUS_ACTIVE;
    setMutatingId(offer.id);
    setError('');
    try {
      const resp = goingToActive
        ? await OffersApi.enable(offer.id)
        : await OffersApi.disable(offer.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update offer.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to update offer.',
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(offer) {
    const ok = window.confirm(
      `Soft-delete offer "${offer.title}"? It will disappear from the app immediately.`,
    );
    if (!ok) return;
    setMutatingId(offer.id);
    setError('');
    try {
      const resp = await OffersApi.delete(offer.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete offer.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to delete offer.',
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
        title="Offers"
        subtitle="Promotional offers shown in the app — city, brand and model targeting."
        actions={
          <Button onClick={() => setEditorOffer(null)}>
            <Plus className="h-4 w-4" />
            New offer
          </Button>
        }
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
              placeholder="Search offer title…"
              leftIcon={<Search className="h-4 w-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ToolbarSelect
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: '', label: 'All types' },
                ...OFFER_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />
            <ToolbarSelect
              label="Sort by"
              value={sortBy}
              onChange={(v) => {
                setSortBy(v);
                setPage(0);
              }}
              options={[
                { value: 'priority', label: 'Priority' },
                { value: 'title', label: 'Title' },
                { value: 'endsAt', label: 'Ends soonest' },
                { value: 'id', label: 'Newest' },
              ]}
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
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Cities</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
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
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <EmptyState
                      icon={BadgePercent}
                      title={
                        debouncedQuery.trim() || typeFilter
                          ? 'No offers match your filters'
                          : 'No offers yet'
                      }
                      description={
                        debouncedQuery.trim() || typeFilter
                          ? 'Try different filters, or clear the search.'
                          : 'Create the first offer — it powers the Offers section in the app.'
                      }
                      action={
                        !debouncedQuery.trim() && !typeFilter ? (
                          <Button onClick={() => setEditorOffer(null)}>
                            <Plus className="h-4 w-4" />
                            New offer
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <OfferThumb offer={offer} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">
                            {offer.title}
                          </div>
                          <div className="truncate text-xs text-emerald-700 font-semibold">
                            {offer.benefitText}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <TypeChip type={offer.offerType} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <ScopeSummary offer={offer} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {offer.targetCities?.length
                        ? `${offer.targetCities.length} ${offer.targetCities.length === 1 ? 'city' : 'cities'}`
                        : 'All cities'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <ScheduleSummary offer={offer} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={offer.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setImageOffer(offer)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {offer.imageUrl ? 'Image' : 'Add image'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setEditorOffer(offer)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            offer.status === STATUS_ACTIVE ? 'ghost' : 'secondary'
                          }
                          loading={mutatingId === offer.id}
                          disabled={mutatingId !== null}
                          onClick={() => handleToggle(offer)}
                        >
                          {offer.status === STATUS_ACTIVE ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => handleDelete(offer)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
                ? 'No offers.'
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

      {editorOffer !== undefined && (
        <OfferEditorModal
          offer={editorOffer}
          onClose={() => setEditorOffer(undefined)}
          onSaved={() => {
            setEditorOffer(undefined);
            reloadAll();
          }}
        />
      )}

      {imageOffer && (
        <OfferImageModal
          offer={imageOffer}
          onClose={() => setImageOffer(null)}
          onSaved={() => {
            setImageOffer(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Editor modal
// =============================================================================
function OfferEditorModal({ offer, onClose, onSaved }) {
  const isEdit = Boolean(offer);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cities, setCities] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    let cancelled = false;
    CitiesApi.getAll()
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') setCities(resp.data.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (offer) {
      setForm({
        title: offer.title || '',
        benefitText: offer.benefitText || '',
        description: offer.description || '',
        termsAndConditions: offer.termsAndConditions || '',
        offerType: offer.offerType || 'DISCOUNT',
        scope: offer.vehicle ? 'VEHICLE' : offer.brand ? 'BRAND' : 'GLOBAL',
        brandId: offer.brand?.id ?? '',
        vehicleId: offer.vehicle?.id ?? '',
        priority: offer.priority ?? 0,
        startsAt: toLocalInput(offer.startsAt),
        endsAt: toLocalInput(offer.endsAt),
        targetCityIds: (offer.targetCities || []).map((c) => c.id),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setServerError('');
    setSubmitting(false);
  }, [offer]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  const liveStatus = useMemo(() => {
    const now = new Date();
    const starts = form.startsAt ? new Date(form.startsAt) : null;
    const ends = form.endsAt ? new Date(form.endsAt) : null;
    if (starts && starts > now)
      return { tone: 'sky', label: `Scheduled — goes live ${starts.toLocaleString()}` };
    if (ends && ends < now)
      return { tone: 'amber', label: `Expired ${ends.toLocaleString()} — users won't see it` };
    return { tone: 'emerald', label: 'Currently visible to users (if enabled)' };
  }, [form.startsAt, form.endsAt]);

  function toggleCity(cityId) {
    setForm((f) => {
      const has = f.targetCityIds.includes(cityId);
      return {
        ...f,
        targetCityIds: has
          ? f.targetCityIds.filter((id) => id !== cityId)
          : [...f.targetCityIds, cityId],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setServerError('Title is required.');
      return;
    }
    if (!form.benefitText.trim()) {
      setServerError('Benefit text is required — it is the headline of the offer card.');
      return;
    }
    if (form.scope === 'BRAND' && !form.brandId) {
      setServerError('Please pick a brand for this offer.');
      return;
    }
    if (form.scope === 'VEHICLE' && !form.vehicleId) {
      setServerError('Please pick a vehicle for this offer.');
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        title: form.title.trim(),
        benefitText: form.benefitText.trim(),
        description: form.description.trim() || null,
        termsAndConditions: form.termsAndConditions.trim() || null,
        offerType: form.offerType,
        brandId: form.scope === 'BRAND' ? Number(form.brandId) : null,
        vehicleId: form.scope === 'VEHICLE' ? Number(form.vehicleId) : null,
        priority: Number(form.priority) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        targetCityIds: form.targetCityIds,
      };
      const resp = isEdit
        ? await OffersApi.update(offer.id, body)
        : await OffersApi.create(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save offer.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to save offer.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      size="xl"
      title={isEdit ? `Edit offer #${offer.id}` : 'New offer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="offer-editor-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create offer'}
          </Button>
        </>
      }
    >
      <form id="offer-editor-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Title">
            <Input
              autoFocus
              maxLength={80}
              placeholder="Monsoon exchange carnival"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </Field>
          <Field label="Benefit (headline on the card)">
            <Input
              maxLength={120}
              placeholder="Up to ₹7,000 off on exchange"
              value={form.benefitText}
              onChange={(e) => update({ benefitText: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Offer type">
            <SelectNative
              value={form.offerType}
              onChange={(v) => update({ offerType: v })}
              options={OFFER_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />
          </Field>
          <Field label="Priority">
            <Input
              type="number"
              inputMode="numeric"
              value={form.priority}
              onChange={(e) => update({ priority: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Input
            maxLength={500}
            placeholder="Shown under the headline on the offer card"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </Field>

        <Field label="Terms & conditions (optional)">
          <textarea
            rows={3}
            maxLength={3000}
            placeholder="One condition per line — shown in the expandable T&C block"
            value={form.termsAndConditions}
            onChange={(e) => update({ termsAndConditions: e.target.value })}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </Field>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            What does this offer apply to?
          </div>
          <SelectNative
            value={form.scope}
            onChange={(v) => update({ scope: v, brandId: '', vehicleId: '' })}
            options={[
              { value: 'GLOBAL', label: 'App-wide (everything)' },
              { value: 'BRAND', label: 'A brand (all its models)' },
              { value: 'VEHICLE', label: 'A specific vehicle' },
            ]}
          />
          {form.scope === 'BRAND' && (
            <Field label="Brand">
              <BrandPicker
                selectedId={form.brandId}
                onChange={(id) => update({ brandId: id })}
              />
            </Field>
          )}
          {form.scope === 'VEHICLE' && (
            <Field label="Vehicle">
              <VehiclePicker
                selectedId={form.vehicleId}
                onChange={(id) => update({ vehicleId: id })}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Starts at (optional)">
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => update({ startsAt: e.target.value })}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </Field>
          <Field label="Ends at (optional)">
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => update({ endsAt: e.target.value })}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </Field>
        </div>

        <div
          className={cn(
            'rounded-lg px-3 py-2 text-[11px] font-medium',
            liveStatus.tone === 'emerald' && 'bg-emerald-50 text-emerald-700',
            liveStatus.tone === 'sky' && 'bg-sky-50 text-sky-700',
            liveStatus.tone === 'amber' && 'bg-amber-50 text-amber-700',
          )}
        >
          {liveStatus.label}
        </div>

        <Field label="City targeting">
          {cities.length === 0 ? (
            <div className="text-xs text-slate-500">No cities available.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {cities.map((c) => {
                const active = form.targetCityIds.includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleCity(c.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">
            {form.targetCityIds.length === 0
              ? 'No restriction — offer shows in every city.'
              : `Limited to ${form.targetCityIds.length} ${form.targetCityIds.length === 1 ? 'city' : 'cities'}.`}
          </div>
        </Field>

        {serverError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError}
          </div>
        )}

        {!isEdit && (
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Create the offer first, then upload its image from the list (the offer ID is part of the S3 key).
          </div>
        )}
      </form>
    </Modal>
  );
}

// =============================================================================
// Image upload modal — mirrors the banner image modal
// =============================================================================
function OfferImageModal({ offer, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [localError, setLocalError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewURL('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handlePick(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setLocalError('Only image files are allowed.');
      setFile(null);
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setLocalError('File size must be 3 MB or less.');
      setFile(null);
      return;
    }
    setLocalError('');
    setFile(picked);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setServerError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await OffersApi.addImage(offer.id, fd);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to upload image.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to upload image.',
      );
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove this offer image?')) return;
    setRemoving(true);
    setServerError('');
    try {
      const resp = await OffersApi.removeImage(offer.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to remove image.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to remove image.',
      );
      setRemoving(false);
    }
  }

  const busy = submitting || removing;

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title={`Offer image — #${offer.id}`}
      footer={
        <>
          {offer.imageUrl && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              loading={removing}
              disabled={busy}
              className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="offer-image-form"
            loading={submitting}
            disabled={busy || !file}
          >
            Upload
          </Button>
        </>
      }
    >
      <form id="offer-image-form" onSubmit={handleUpload} className="space-y-3">
        <div className="flex items-start gap-4">
          <div className="flex h-28 w-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {previewURL ? (
              <img src={previewURL} alt="Preview" className="h-full w-full object-cover" />
            ) : offer.imageUrl ? (
              <img src={offer.imageUrl} alt="Current" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-300" />
            )}
          </div>
          <div className="flex-1 text-xs text-slate-500">
            <div className="mb-2">PNG, JPG, or WebP. 16:9 recommended. Max 3 MB.</div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Upload className="h-3.5 w-3.5" />
              {file ? 'Choose different file' : 'Choose file'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePick}
            />
            {file && (
              <div className="mt-2 truncate text-[11px] text-slate-500">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </div>
            )}
          </div>
        </div>
        {(localError || serverError) && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError || localError}
          </div>
        )}
      </form>
    </Modal>
  );
}

// =============================================================================
// Small presentational helpers
// =============================================================================
function Field({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SelectNative({ value, onChange, options }) {
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

function TypeChip({ type }) {
  const def = OFFER_TYPES.find((t) => t.value === type);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        def?.tone || 'bg-slate-100 text-slate-600',
      )}
    >
      {def?.label || type || '—'}
    </span>
  );
}

function ScopeSummary({ offer }) {
  if (offer.vehicle) {
    const brand = offer.vehicle.brand?.name;
    const label = brand
      ? `${brand} · ${offer.vehicle.model}`
      : offer.vehicle.model || `Vehicle #${offer.vehicle.id}`;
    return <span title="Model-specific offer">{label}</span>;
  }
  if (offer.brand) {
    return <span title="Brand-wide offer">{offer.brand.name} (brand)</span>;
  }
  return <span className="text-slate-400">App-wide</span>;
}

function ScheduleSummary({ offer }) {
  if (!offer.startsAt && !offer.endsAt) {
    return <span className="text-slate-400">Always on</span>;
  }
  const now = new Date();
  const starts = offer.startsAt ? new Date(offer.startsAt) : null;
  const ends = offer.endsAt ? new Date(offer.endsAt) : null;
  if (starts && starts > now) return <span>Starts {fmt(starts)}</span>;
  if (ends && ends < now)
    return <span className="text-amber-600">Expired {fmt(ends)}</span>;
  if (ends) return <span>Ends {fmt(ends)}</span>;
  return <span>Since {fmt(starts)}</span>;
}

function StatusBadge({ status }) {
  const isActive = status === STATUS_ACTIVE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isActive
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-emerald-500' : 'bg-amber-500',
        )}
      />
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}

function OfferThumb({ offer }) {
  if (!offer.imageUrl) {
    return (
      <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <BadgePercent className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={offer.imageUrl}
      alt={`${offer.title} image`}
      className="h-9 w-14 shrink-0 rounded-md border border-slate-200 bg-white object-cover"
      loading="lazy"
    />
  );
}

// -----------------------------------------------------------------------------
// Pickers — same UX as the banner page's pickers
// -----------------------------------------------------------------------------
function VehiclePicker({ selectedId, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolvedLabel, setResolvedLabel] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (!selectedId) {
      setResolvedLabel('');
      return;
    }
    let cancelled = false;
    VehiclesApi.getById(selectedId)
      .then((resp) => {
        if (cancelled) return;
        const v = resp?.data?.data;
        if (v) setResolvedLabel(formatVehicleLabel(v));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getAll({
      page: 0,
      size: 10,
      sortBy: 'model',
      sortDir: 'asc',
      q: debouncedQuery.trim() || undefined,
    })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setResults(resp.data.data?.content || []);
        } else {
          setResults([]);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  function pick(v) {
    onChange(v.id);
    setResolvedLabel(formatVehicleLabel(v));
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative">
      <Input
        leftIcon={<Search className="h-4 w-4" />}
        placeholder={
          selectedId && resolvedLabel ? resolvedLabel : 'Type to search vehicles…'
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selectedId && !query && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Selected:{' '}
            <span className="font-semibold text-slate-700">
              {resolvedLabel || `Vehicle #${selectedId}`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setResolvedLabel('');
              setQuery('');
            }}
            className="text-red-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}
      {open && (query.trim() || results.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-xs text-slate-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">
              No matches{query.trim() ? ` for "${query.trim()}"` : ''}.
            </div>
          ) : (
            results.map((v) => (
              <button
                type="button"
                key={v.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(v);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">
                  {formatVehicleLabel(v)}
                </div>
                {v.priceRange && (
                  <div className="text-[11px] text-slate-500">{v.priceRange}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatVehicleLabel(v) {
  if (!v) return '';
  const brand = v.brand?.name || '';
  const model = v.model || `Vehicle #${v.id}`;
  return brand ? `${brand} · ${model}` : model;
}

function BrandPicker({ selectedId, onChange }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    BrandsApi.getAll({ page: 0, size: 200, sortBy: 'name', sortDir: 'asc' })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setBrands(resp.data.data?.content || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="text-xs text-slate-500">Loading brands…</div>;
  }
  return (
    <SelectNative
      value={selectedId || ''}
      onChange={(v) => onChange(v ? Number(v) : '')}
      options={[
        { value: '', label: 'Choose a brand…' },
        ...brands.map((b) => ({ value: b.id, label: b.name })),
      ]}
    />
  );
}

function fmt(dt) {
  return dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Convert backend ISO string → datetime-local input value (no tz, seconds dropped).
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
