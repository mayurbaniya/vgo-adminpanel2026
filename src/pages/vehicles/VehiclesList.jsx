import { useEffect, useState } from 'react';
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleSlash,
  Image as ImageIcon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Brands as BrandsApi, Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';
import VehicleEditModal from './VehicleEditModal.jsx';

// vehicle.status.{active,disable,deleted} from application.properties
const STATUS_ACTIVE = 1;
const STATUS_DISABLED = 99;
const STATUS_DELETED = 0;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'model', label: 'Model' },
  { value: 'manufacturingYear', label: 'Year' },
  { value: 'price', label: 'Price' },
  { value: 'modified', label: 'Updated' },
];

const NO_IMAGE_SUFFIX = '/other/not-found.png';

function hasRealImage(url) {
  return Boolean(url) && !url.endsWith(NO_IMAGE_SUFFIX);
}

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

export default function VehiclesList() {
  const [vehicles, setVehicles] = useState([]);
  const [counts, setCounts] = useState(null);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('modified');
  const [sortDir, setSortDir] = useState('desc');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | STATUS_ACTIVE | STATUS_DISABLED
  const [brandFilter, setBrandFilter] = useState(0); // 0 = all brands
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // 'new' | vehicle | null
  const [editInitialTab, setEditInitialTab] = useState('basic');
  const [reloadKey, setReloadKey] = useState(0);

  // Reset to page 0 on any filter change.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, statusFilter, brandFilter]);

  // Load brands once for the brand filter dropdown.
  useEffect(() => {
    let cancelled = false;
    BrandsApi.getAll({ size: 1000, sortBy: 'name', sortDir: 'asc' })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setBrands(resp.data.data?.content || []);
        }
      })
      .catch(() => {
        // brand filter degrades to 'all' if this fails; non-blocking
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      q: debouncedQuery.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      brandID: brandFilter || undefined,
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
          setVehicles(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else if (status === 'EMPTY') {
          setVehicles([]);
          setMeta({
            pageNumber: page,
            totalPages: 0,
            totalElements: 0,
            lastPage: true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load vehicles.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load vehicles.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    page,
    pageSize,
    sortBy,
    sortDir,
    debouncedQuery,
    statusFilter,
    brandFilter,
    reloadKey,
  ]);

  useEffect(() => {
    let cancelled = false;
    VehiclesApi.countSummary()
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') setCounts(resp.data.data);
      })
      .catch(() => {
        // counts are non-critical chrome — silent
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function handleToggle(vehicle) {
    const goingToActive = Number(vehicle.status) !== STATUS_ACTIVE;
    setMutatingId(vehicle.id);
    setError('');
    try {
      const resp = goingToActive
        ? await VehiclesApi.enable(vehicle.id)
        : await VehiclesApi.disable(vehicle.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update vehicle.');
      }
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id
            ? {
                ...v,
                status: goingToActive ? STATUS_ACTIVE : STATUS_DISABLED,
              }
            : v,
        ),
      );
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to update vehicle.',
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(vehicle) {
    const ok = window.confirm(
      `Soft-delete "${vehicle.model}"? It will be hidden from the catalog.`,
    );
    if (!ok) return;
    setMutatingId(vehicle.id);
    setError('');
    try {
      const resp = await VehiclesApi.delete(vehicle.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete vehicle.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to delete vehicle.',
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
        title="Vehicles"
        subtitle="Catalog of new vehicles surfaced to consumers."
        actions={
          <Button
            onClick={() => {
              setEditInitialTab('basic');
              setEditTarget('new');
            }}
          >
            <Plus className="h-4 w-4" />
            Add vehicle
          </Button>
        }
      />

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountChip label="Total" value={counts.totalVehicles} />
          <CountChip label="Active" value={counts.activeVehicles} tone="emerald" />
          <CountChip
            label="Disabled"
            value={counts.disabledVehicles}
            tone="amber"
          />
          <CountChip
            label="Deleted"
            value={counts.deletedVehicles}
            tone="slate"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search model, variant, color, year…"
              leftIcon={<Search className="h-4 w-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ToolbarSelect
              label="Brand"
              value={brandFilter}
              onChange={(v) => setBrandFilter(Number(v) || 0)}
              options={[
                { value: 0, label: 'All brands' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
              ]}
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

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 text-xs">
          {[
            { value: 'all', label: 'All' },
            { value: STATUS_ACTIVE, label: 'Active' },
            { value: STATUS_DISABLED, label: 'Disabled' },
            { value: STATUS_DELETED, label: 'Deleted' },
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
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Engine</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
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
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12">
                    <EmptyState
                      icon={Bike}
                      title={
                        debouncedQuery.trim() ||
                        statusFilter !== 'all' ||
                        brandFilter
                          ? 'No vehicles match your filters'
                          : 'No vehicles yet'
                      }
                      description={
                        debouncedQuery.trim() ||
                        statusFilter !== 'all' ||
                        brandFilter
                          ? 'Try clearing the filters above.'
                          : 'Add the first vehicle to start the catalog.'
                      }
                      action={
                        !debouncedQuery.trim() &&
                        statusFilter === 'all' &&
                        !brandFilter ? (
                          <Button
                            onClick={() => {
                              setEditInitialTab('basic');
                              setEditTarget('new');
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Add vehicle
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  // Defensive coercion: backend should send int, but if any
                  // upstream serializer sneaks in a string ("1"/"99"/"0"),
                  // strict === would silently bypass the action branches.
                  const vStatus = Number(v.status);
                  return (
                  <tr key={v.id} className="align-top hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <VehicleThumb vehicle={v} />
                        <div>
                          <div className="font-medium text-slate-900">
                            {v.model || '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {[v.variant, v.color, v.manufacturingYear]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                          {v.isElectric === 'Y' && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              <Zap className="h-2.5 w-2.5" />
                              EV
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {v.brand?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {v.powerCC > 0 ? `${v.powerCC} cc` : '—'}
                      {v.vehicleType && (
                        <div className="text-slate-400">{v.vehicleType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div>{v.price || '—'}</div>
                      {v.priceRange && (
                        <div className="text-[11px] text-slate-400">
                          {v.priceRange}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={vStatus} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {formatDate(v.modified)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {vStatus === STATUS_DELETED ? (
                          // Deleted row: only restore makes sense.
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={mutatingId === v.id}
                            disabled={mutatingId !== null}
                            onClick={() => handleToggle(v)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditInitialTab('images');
                                setEditTarget(v);
                              }}
                              disabled={mutatingId !== null}
                              title="Manage images"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditInitialTab('basic');
                                setEditTarget(v);
                              }}
                              disabled={mutatingId !== null}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {vStatus === STATUS_ACTIVE ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={mutatingId === v.id}
                                disabled={mutatingId !== null}
                                onClick={() => handleToggle(v)}
                                className="text-amber-700 hover:bg-amber-50"
                              >
                                <CircleSlash className="h-3.5 w-3.5" />
                                Disable
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={mutatingId === v.id}
                                disabled={mutatingId !== null}
                                onClick={() => handleToggle(v)}
                                className="text-emerald-700 hover:bg-emerald-50"
                              >
                                <CircleCheck className="h-3.5 w-3.5" />
                                Enable
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={mutatingId !== null}
                              onClick={() => handleDelete(v)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
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
                ? debouncedQuery.trim() ||
                  statusFilter !== 'all' ||
                  brandFilter
                  ? 'No matches.'
                  : 'No vehicles.'
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

      <VehicleEditModal
        target={editTarget}
        brands={brands}
        initialTab={editInitialTab}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          reloadAll();
        }}
      />
    </div>
  );
}

function VehicleThumb({ vehicle }) {
  const first = (vehicle.images || []).find(hasRealImage);
  if (!first) {
    return (
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <Bike className="h-5 w-5" />
      </div>
    );
  }
  return (
    <img
      src={first}
      alt={vehicle.model}
      className="h-12 w-12 flex-shrink-0 rounded-md border border-slate-200 bg-white object-cover"
      loading="lazy"
    />
  );
}

function StatusBadge({ status }) {
  const s = Number(status);
  const cfg =
    s === STATUS_ACTIVE
      ? { tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', label: 'Active' }
      : s === STATUS_DELETED
        ? { tone: 'bg-red-50 text-red-700', dot: 'bg-red-500', label: 'Deleted' }
        : { tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', label: 'Disabled' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        cfg.tone,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
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
        onChange={(e) => onChange(e.target.value)}
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
  const toneClasses = {
    brand: 'border-brand-100 bg-brand-50 text-brand-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone];
  return (
    <div className={cn('rounded-xl border px-4 py-3', toneClasses)}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold">{value ?? '—'}</div>
    </div>
  );
}
