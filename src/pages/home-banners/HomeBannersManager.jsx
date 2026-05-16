import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Plus,
  Search,
  Trash2,
  Upload,
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
  HomeBanners as BannersApi,
  Brands as BrandsApi,
  Cities as CitiesApi,
  Vehicles as VehiclesApi,
} from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

// banner.status.* from application.properties
const STATUS_ACTIVE = 1;
const STATUS_DISABLED = 99;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const SURFACE_OPTIONS = [
  { value: '', label: 'All surfaces' },
  { value: 'BIKES', label: 'Bikes home' },
  { value: 'CARS', label: 'Cars home' },
  { value: 'BOTH', label: 'Both homes' },
];

const CTA_TYPES = [
  { value: 'NONE', label: 'No action (decorative)' },
  { value: 'VEHICLE', label: 'Open a specific vehicle' },
  { value: 'BRAND', label: 'Open all vehicles of a brand' },
  { value: 'BODY_TYPE', label: 'Open vehicles by body type' },
  { value: 'BROWSE_ALL', label: 'Open browse-all list' },
  { value: 'EXTERNAL_URL', label: 'Open external URL in browser' },
];

// Body types — match `vehicle.body.*` in backend application.properties.
const BODY_TYPES = [
  { value: 'SPORTS', label: 'Sports' },
  { value: 'STREET', label: 'Street' },
  { value: 'MOFET', label: 'Scooter' },
];

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'Everyone' },
  { value: 'NEW_USERS', label: 'New users' },
  { value: 'RETURNING_USERS', label: 'Returning users' },
  { value: 'GOOGLE_AUTH', label: 'Google sign-in users' },
  { value: 'EMAIL_AUTH', label: 'Email/password users' },
];

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  surface: 'BOTH',
  ctaType: 'NONE',
  ctaTargetId: '',
  ctaTargetUrl: '',
  priority: 0,
  startsAt: '',
  endsAt: '',
  audience: 'ALL',
  targetCityIds: [],
};

export default function HomeBannersManager() {
  const [banners, setBanners] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
    activeElements: 0,
    inactiveElements: 0,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('priority');
  const [sortDir, setSortDir] = useState('desc');
  const [surface, setSurface] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editorBanner, setEditorBanner] = useState(null); // {} for create, {id, ...} for edit
  const [imageBanner, setImageBanner] = useState(null);
  const [analyticsBanner, setAnalyticsBanner] = useState(null);

  // Drag-to-reorder state
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, surface]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    BannersApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      q: debouncedQuery.trim() || undefined,
      surface: surface || undefined,
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
          setBanners(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
            activeElements: payload?.activeElements ?? 0,
            inactiveElements: payload?.inactiveElements ?? 0,
          });
          setError('');
        } else if (status === 'EMPTY') {
          setBanners([]);
          setMeta((m) => ({ ...m, pageNumber: page, totalPages: 0, totalElements: 0, lastPage: true }));
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load banners.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.msg || err?.message || 'Failed to load banners.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, surface, reloadKey]);

  const reloadAll = () => setReloadKey((k) => k + 1);

  async function handleToggle(banner) {
    const goingToActive = banner.status !== STATUS_ACTIVE;
    setMutatingId(banner.id);
    setError('');
    try {
      const resp = goingToActive
        ? await BannersApi.enable(banner.id)
        : await BannersApi.disable(banner.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update banner.');
      }
      reloadAll();
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to update banner.');
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(banner) {
    if (!window.confirm(`Soft-delete banner "${banner.title || `#${banner.id}`}"?`)) return;
    setMutatingId(banner.id);
    setError('');
    try {
      const resp = await BannersApi.delete(banner.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete banner.');
      }
      reloadAll();
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to delete banner.');
    } finally {
      setMutatingId(null);
    }
  }

  async function persistReorder(orderedBanners) {
    setError('');
    try {
      const payload = orderedBanners.map((b, idx) => ({
        id: b.id,
        priority: orderedBanners.length - idx, // top of list = highest priority
      }));
      const resp = await BannersApi.reorder(payload);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save order.');
      }
      reloadAll();
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to save order.');
      reloadAll();
    }
  }

  function handleDrop() {
    if (dragId == null || dragOverId == null || dragId === dragOverId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = banners.findIndex((b) => b.id === dragId);
    const toIdx = banners.findIndex((b) => b.id === dragOverId);
    if (fromIdx < 0 || toIdx < 0) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const next = banners.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setBanners(next);
    setDragId(null);
    setDragOverId(null);
    persistReorder(next);
  }

  const showingFrom = meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0 ? 0 : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home Banners"
        subtitle="Promotional carousel shown on the mobile home screens. Drag rows to reorder."
        actions={
          <Button onClick={() => setEditorBanner({})}>
            <Plus className="h-4 w-4" />
            New banner
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountChip label="Total on page" value={banners.length} />
        <CountChip label="Active" value={meta.activeElements} tone="emerald" />
        <CountChip label="Disabled" value={meta.inactiveElements} tone="amber" />
        <CountChip label="All-time" value={meta.totalElements} tone="slate" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Input
              leftIcon={<Search className="h-4 w-4" />}
              placeholder="Search by title…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-xs"
            />
            <ToolbarSelect
              label="Surface"
              value={surface}
              onChange={setSurface}
              options={SURFACE_OPTIONS}
            />
          </div>
          <div className="flex items-center gap-2">
            <ToolbarSelect
              label="Sort"
              value={`${sortBy}:${sortDir}`}
              onChange={(v) => {
                const [s, d] = String(v).split(':');
                setSortBy(s);
                setSortDir(d);
              }}
              options={[
                { value: 'priority:desc', label: 'Priority ↓' },
                { value: 'priority:asc', label: 'Priority ↑' },
                { value: 'modified:desc', label: 'Recently edited' },
                { value: 'id:desc', label: 'Newest' },
              ]}
            />
            <ToolbarSelect
              label="Rows"
              value={pageSize}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
              options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-10 px-2 py-3"></th>
                <th className="px-4 py-3">Banner</th>
                <th className="px-4 py-3">Surface</th>
                <th className="px-4 py-3">CTA</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : banners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      icon={Layers}
                      title={
                        debouncedQuery.trim() || surface
                          ? 'No banners match your filters'
                          : 'No banners yet'
                      }
                      description={
                        debouncedQuery.trim() || surface
                          ? 'Try clearing the search or surface filter.'
                          : 'Create the first banner to start serving promotional content to the mobile home screens.'
                      }
                      action={
                        !debouncedQuery.trim() && !surface ? (
                          <Button onClick={() => setEditorBanner({})}>
                            <Plus className="h-4 w-4" />
                            New banner
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                banners.map((banner) => (
                  <tr
                    key={banner.id}
                    className={cn(
                      'transition',
                      dragOverId === banner.id && 'bg-brand-50/60',
                      dragId === banner.id && 'opacity-50',
                      'hover:bg-slate-50/50',
                    )}
                    draggable={sortBy === 'priority'}
                    onDragStart={() => setDragId(banner.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverId(banner.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    onDrop={handleDrop}
                  >
                    <td className="px-2 py-3 text-slate-400">
                      <GripVertical
                        className={cn(
                          'h-4 w-4',
                          sortBy === 'priority' ? 'cursor-grab' : 'opacity-30',
                        )}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <BannerThumb banner={banner} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">
                            {banner.title || <span className="text-slate-400">Untitled</span>}
                          </div>
                          {banner.subtitle && (
                            <div className="truncate text-xs text-slate-500">{banner.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SurfaceBadge surface={banner.surface} />
                    </td>
                    <td className="px-4 py-3">
                      <CtaSummary banner={banner} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <ScheduleSummary banner={banner} />
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                      {banner.priority ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={banner.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setImageBanner(banner)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {banner.imageUrl ? 'Replace' : 'Image'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setEditorBanner(banner)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={banner.status === STATUS_ACTIVE ? 'ghost' : 'secondary'}
                          loading={mutatingId === banner.id}
                          disabled={mutatingId !== null}
                          onClick={() => handleToggle(banner)}
                        >
                          {banner.status === STATUS_ACTIVE ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setAnalyticsBanner(banner)}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => handleDelete(banner)}
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
                ? 'No banners.'
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

      {editorBanner && (
        <BannerEditorModal
          banner={editorBanner.id ? editorBanner : null}
          onClose={() => setEditorBanner(null)}
          onSaved={() => {
            setEditorBanner(null);
            reloadAll();
          }}
        />
      )}

      {imageBanner && (
        <BannerImageModal
          banner={imageBanner}
          onClose={() => setImageBanner(null)}
          onSaved={() => {
            setImageBanner(null);
            reloadAll();
          }}
        />
      )}

      {analyticsBanner && (
        <BannerAnalyticsModal
          banner={analyticsBanner}
          onClose={() => setAnalyticsBanner(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// Editor modal — create + edit form with live mobile-frame preview
// =============================================================================
function BannerEditorModal({ banner, onClose, onSaved }) {
  const isEdit = Boolean(banner);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cities, setCities] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Load city list once.
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

  // Seed form when editing.
  useEffect(() => {
    if (banner) {
      setForm({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        surface: banner.surface || 'BOTH',
        ctaType: banner.ctaType || 'NONE',
        ctaTargetId: banner.ctaTargetId ?? '',
        ctaTargetUrl: banner.ctaTargetUrl || '',
        priority: banner.priority ?? 0,
        startsAt: toLocalInput(banner.startsAt),
        endsAt: toLocalInput(banner.endsAt),
        audience: banner.audience || 'ALL',
        targetCityIds: (banner.targetCities || []).map((c) => c.id),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setServerError('');
    setSubmitting(false);
  }, [banner]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  const liveStatus = useMemo(() => {
    const now = new Date();
    const starts = form.startsAt ? new Date(form.startsAt) : null;
    const ends = form.endsAt ? new Date(form.endsAt) : null;
    if (starts && starts > now) return { kind: 'scheduled', label: `Scheduled · ${starts.toLocaleString()}` };
    if (ends && ends < now) return { kind: 'expired', label: `Expired · ${ends.toLocaleString()}` };
    return { kind: 'live', label: 'Currently visible to users' };
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
    if (form.ctaType === 'EXTERNAL_URL' && !form.ctaTargetUrl.trim()) {
      setServerError('Please enter a URL for the external link.');
      return;
    }
    if (form.ctaType === 'VEHICLE' && !form.ctaTargetId) {
      setServerError('Please pick a vehicle for the tap target.');
      return;
    }
    if (form.ctaType === 'BRAND' && !form.ctaTargetId) {
      setServerError('Please pick a brand for the tap target.');
      return;
    }
    if (form.ctaType === 'BODY_TYPE' && !form.ctaTargetUrl) {
      setServerError('Please pick a body type for the tap target.');
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        surface: form.surface,
        ctaType: form.ctaType,
        ctaTargetId: form.ctaTargetId ? Number(form.ctaTargetId) : null,
        ctaTargetUrl: form.ctaTargetUrl.trim() || null,
        priority: Number(form.priority) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        audience: form.audience,
        targetCityIds: form.targetCityIds,
      };
      const resp = isEdit
        ? await BannersApi.update(banner.id, body)
        : await BannersApi.create(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save banner.');
      }
      onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to save banner.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      size="xl"
      title={isEdit ? `Edit banner #${banner.id}` : 'New banner'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="banner-editor-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create banner'}
          </Button>
        </>
      }
    >
      <form
        id="banner-editor-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,260px]"
      >
        <div className="space-y-4">
          <Field label="Title">
            <Input
              autoFocus
              maxLength={80}
              placeholder="Festival sale ends midnight"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </Field>

          <Field label="Subtitle (optional)">
            <Input
              maxLength={160}
              placeholder="Up to 30% off + zero processing fee"
              value={form.subtitle}
              onChange={(e) => update({ subtitle: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Surface">
              <SelectNative
                value={form.surface}
                onChange={(v) => update({ surface: v })}
                options={[
                  { value: 'BIKES', label: 'Bikes home only' },
                  { value: 'CARS', label: 'Cars home only' },
                  { value: 'BOTH', label: 'Both homes' },
                ]}
              />
            </Field>
            <Field label="Audience">
              <SelectNative
                value={form.audience}
                onChange={(v) => update({ audience: v })}
                options={AUDIENCE_OPTIONS}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              What happens when a user taps this banner?
            </div>
            <SelectNative
              value={form.ctaType}
              onChange={(v) => update({ ctaType: v, ctaTargetId: '', ctaTargetUrl: '' })}
              options={CTA_TYPES}
            />

            {form.ctaType === 'VEHICLE' && (
              <Field label="Vehicle">
                <VehiclePicker
                  selectedId={form.ctaTargetId}
                  onChange={(id) => update({ ctaTargetId: id })}
                />
              </Field>
            )}

            {form.ctaType === 'BRAND' && (
              <Field label="Brand">
                <BrandPicker
                  selectedId={form.ctaTargetId}
                  onChange={(id) => update({ ctaTargetId: id })}
                />
              </Field>
            )}

            {form.ctaType === 'BODY_TYPE' && (
              <Field label="Body type">
                <SelectNative
                  value={form.ctaTargetUrl || ''}
                  onChange={(v) => update({ ctaTargetUrl: v })}
                  options={[
                    { value: '', label: 'Choose a body type…' },
                    ...BODY_TYPES,
                  ]}
                />
              </Field>
            )}

            {form.ctaType === 'BROWSE_ALL' && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
                Opens the full vehicle list on the {form.surface === 'CARS'
                  ? 'cars'
                  : form.surface === 'BIKES'
                    ? 'bikes'
                    : "user's current"}{' '}
                home — nothing else to configure.
              </div>
            )}

            {form.ctaType === 'EXTERNAL_URL' && (
              <Field label="URL">
                <Input
                  leftIcon={<LinkIcon className="h-4 w-4" />}
                  placeholder="https://…"
                  value={form.ctaTargetUrl}
                  onChange={(e) => update({ ctaTargetUrl: e.target.value })}
                />
              </Field>
            )}

            {form.ctaType === 'NONE' && (
              <div className="text-[11px] text-slate-500">
                Banner will be purely decorative — tapping it does nothing.
              </div>
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

          <ScheduleHint status={liveStatus} />

          <Field label="Priority">
            <Input
              type="number"
              inputMode="numeric"
              value={form.priority}
              onChange={(e) => update({ priority: e.target.value })}
            />
            <div className="mt-1 text-[11px] text-slate-400">
              Higher value = earlier in the carousel. You can also drag rows in the list to reorder.
            </div>
          </Field>

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
                ? 'No restriction — banner shows in every city.'
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
              Create the banner first, then upload an image from the list (we need the banner ID for the S3 key).
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Preview
          </div>
          <PhoneFramePreview
            title={form.title}
            subtitle={form.subtitle}
            imageUrl={banner?.imageUrl}
            surface={form.surface}
          />
        </div>
      </form>
    </Modal>
  );
}

// =============================================================================
// Image upload modal
// =============================================================================
function BannerImageModal({ banner, onClose, onSaved }) {
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
      const resp = await BannersApi.addImage(banner.id, fd);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to upload image.');
      }
      onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to upload image.');
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove this banner image?')) return;
    setRemoving(true);
    setServerError('');
    try {
      const resp = await BannersApi.removeImage(banner.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to remove image.');
      }
      onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to remove image.');
      setRemoving(false);
    }
  }

  const busy = submitting || removing;

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title={`Banner image — #${banner.id}`}
      footer={
        <>
          {banner.imageUrl && (
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
          <Button type="submit" form="banner-image-form" loading={submitting} disabled={busy || !file}>
            Upload
          </Button>
        </>
      }
    >
      <form id="banner-image-form" onSubmit={handleUpload} className="space-y-3">
        <div className="flex items-start gap-4">
          <div className="flex h-28 w-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {previewURL ? (
              <img src={previewURL} alt="Preview" className="h-full w-full object-cover" />
            ) : banner.imageUrl ? (
              <img src={banner.imageUrl} alt="Current" className="h-full w-full object-cover" />
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
// Analytics modal
// =============================================================================
function BannerAnalyticsModal({ banner, onClose }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    BannersApi.analytics(banner.id, {
      from: from.toISOString().slice(0, 19),
      to: to.toISOString().slice(0, 19),
    })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setData(resp.data.data);
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load analytics.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.msg || err?.message || 'Failed to load analytics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [banner.id, days]);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Analytics — ${banner.title || `#${banner.id}`}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'primary' : 'secondary'}
              onClick={() => setDays(d)}
            >
              Last {d}d
            </Button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Impressions" value={data.impressions} />
            <Metric label="Clicks" value={data.clicks} />
            <Metric label="CTR" value={`${(data.ctr * 100).toFixed(2)}%`} />
          </div>
        ) : null}

        <div className="text-[11px] text-slate-500">
          Impressions fire when the banner scrolls into the mobile viewport. Clicks fire on tap.
        </div>
      </div>
    </Modal>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

// =============================================================================
// Helpers
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

// -----------------------------------------------------------------------------
// VehiclePicker — debounced search-as-you-type. Hits /admin/vehicle/all with
// the typed query and shows the top matches as a dropdown. Once a vehicle is
// chosen we keep its label cached so the form shows "Brand · Model" instead
// of the bare numeric id (which is what was confusing admins).
// -----------------------------------------------------------------------------
function VehiclePicker({ selectedId, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolvedLabel, setResolvedLabel] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  // Hydrate the label when editing a banner that already has a vehicle picked.
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

  // Search as the admin types.
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
          selectedId && resolvedLabel
            ? resolvedLabel
            : 'Type to search vehicles…'
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
                  // Prevent input blur before click registers.
                  e.preventDefault();
                  pick(v);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">
                  {formatVehicleLabel(v)}
                </div>
                {v.priceRange && (
                  <div className="text-[11px] text-slate-500">
                    {v.priceRange}
                  </div>
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

// -----------------------------------------------------------------------------
// BrandPicker — loads the brand list once and renders a native select.
// -----------------------------------------------------------------------------
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

function CountChip({ label, value, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className={cn('rounded-xl px-3 py-2.5', tones[tone] || tones.brand)}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-bold">{value ?? '—'}</div>
    </div>
  );
}

function BannerThumb({ banner }) {
  if (!banner.imageUrl) {
    return (
      <div className="flex h-12 w-20 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={banner.imageUrl}
      alt={banner.title || `Banner #${banner.id}`}
      className="h-12 w-20 rounded-md border border-slate-200 bg-white object-cover"
      loading="lazy"
    />
  );
}

function SurfaceBadge({ surface }) {
  const map = {
    BIKES: { label: 'Bikes', cls: 'bg-sky-50 text-sky-700' },
    CARS: { label: 'Cars', cls: 'bg-violet-50 text-violet-700' },
    BOTH: { label: 'Both', cls: 'bg-slate-100 text-slate-700' },
  };
  const conf = map[surface] || map.BOTH;
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', conf.cls)}>
      {conf.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const isActive = status === STATUS_ACTIVE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-amber-500')} />
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}

function CtaSummary({ banner }) {
  switch (banner.ctaType) {
    case 'VEHICLE':
      return (
        <span className="text-xs text-slate-600">
          Vehicle #{banner.ctaTargetId}
        </span>
      );
    case 'BRAND':
      return (
        <span className="text-xs text-slate-600">
          Brand #{banner.ctaTargetId}
        </span>
      );
    case 'BODY_TYPE':
      return (
        <span className="text-xs text-slate-600">
          Body type ·{' '}
          {(BODY_TYPES.find((b) => b.value === banner.ctaTargetUrl)?.label) ||
            banner.ctaTargetUrl}
        </span>
      );
    case 'BROWSE_ALL':
      return <span className="text-xs text-slate-600">Browse all</span>;
    case 'EXTERNAL_URL':
      return (
        <div className="flex items-center gap-1 truncate text-xs text-slate-600">
          <ExternalLink className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[180px]">{banner.ctaTargetUrl}</span>
        </div>
      );
    case 'NONE':
    default:
      return <span className="text-xs text-slate-400">No tap action</span>;
  }
}

function ScheduleSummary({ banner }) {
  const now = Date.now();
  const starts = banner.startsAt ? new Date(banner.startsAt).getTime() : null;
  const ends = banner.endsAt ? new Date(banner.endsAt).getTime() : null;
  if (!starts && !ends) return <span className="text-slate-400">Always</span>;
  if (starts && starts > now) {
    return <span className="text-amber-600">Starts {fmt(new Date(starts))}</span>;
  }
  if (ends && ends < now) {
    return <span className="text-slate-400">Ended {fmt(new Date(ends))}</span>;
  }
  if (ends) {
    return <span className="text-slate-600">Until {fmt(new Date(ends))}</span>;
  }
  return <span className="text-slate-500">Since {fmt(new Date(starts))}</span>;
}

function ScheduleHint({ status }) {
  const tones = {
    live: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    scheduled: 'bg-sky-50 text-sky-700 border-sky-200',
    expired: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <div className={cn('rounded-lg border px-3 py-1.5 text-[11px] font-medium', tones[status.kind])}>
      {status.label}
    </div>
  );
}

function PhoneFramePreview({ title, subtitle, imageUrl, surface }) {
  return (
    <div className="rounded-3xl border-[10px] border-slate-900 bg-slate-50 p-2 shadow-lg">
      <div className="space-y-2">
        <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {surface === 'BIKES' ? 'Bikes home' : surface === 'CARS' ? 'Cars home' : 'Home screen'}
        </div>
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-md">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Banner preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <div className="text-[13px] font-bold leading-tight drop-shadow">
              {title || 'Banner title'}
            </div>
            {subtitle && (
              <div className="mt-1 text-[10px] opacity-90 leading-snug drop-shadow">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full',
                i === 0 ? 'w-4 bg-brand-600' : 'w-1.5 bg-slate-300',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function fmt(dt) {
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Convert backend ISO string → datetime-local input value (no tz, seconds dropped).
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
