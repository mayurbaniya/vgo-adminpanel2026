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
import { UsedVehicles as UsedVehiclesApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';
import UsedVehicleEditModal from './UsedVehicleEditModal.jsx';

// Same status convention as new vehicles: 1 active, 99 disabled, 0 deleted.
const STATUS_ACTIVE = 1;
const STATUS_DISABLED = 99;
const STATUS_DELETED = 0;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'model', label: 'Model' },
  { value: 'manufacturingYear', label: 'Year' },
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

export default function UsedVehiclesList() {
  const { user } = useAuth();
  const adminID = user?.id;

  const [vehicles, setVehicles] = useState([]);
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editInitialTab, setEditInitialTab] = useState('basic');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    UsedVehiclesApi.getAll({
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
          throw new Error(resp?.data?.msg || 'Failed to load used vehicles.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load used vehicles.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, statusFilter, reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function handleToggle(vehicle) {
    const goingToActive = Number(vehicle.status) !== STATUS_ACTIVE;
    setMutatingId(vehicle.id);
    setError('');
    try {
      const resp = goingToActive
        ? await UsedVehiclesApi.enable(vehicle.id)
        : await UsedVehiclesApi.disable(vehicle.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update used vehicle.');
      }
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id
            ? { ...v, status: goingToActive ? STATUS_ACTIVE : STATUS_DISABLED }
            : v,
        ),
      );
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to update used vehicle.',
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(vehicle) {
    const ok = window.confirm(
      `Soft-delete used vehicle "${vehicle.model}"? It can be restored from the Deleted tab.`,
    );
    if (!ok) return;
    setMutatingId(vehicle.id);
    setError('');
    try {
      const resp = await UsedVehiclesApi.delete(vehicle.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete used vehicle.');
      }
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to delete used vehicle.',
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
    ? 'Loading admin session… add disabled until login data is available.'
    : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Used Vehicles"
        subtitle="Inspected pre-owned listings with condition reports."
        actions={
          <Button
            onClick={() => {
              setEditInitialTab('basic');
              setEditTarget('new');
            }}
            disabled={!adminID}
          >
            <Plus className="h-4 w-4" />
            Add used vehicle
          </Button>
        }
      />

      {(error || adminGuardError) && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error || adminGuardError}
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
                <th className="px-4 py-3">Owner</th>
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
                        debouncedQuery.trim() || statusFilter !== 'all'
                          ? 'No used vehicles match your filters'
                          : 'No used vehicles yet'
                      }
                      description={
                        debouncedQuery.trim() || statusFilter !== 'all'
                          ? 'Try clearing the filters above.'
                          : 'Add the first used vehicle to start the pre-owned catalog.'
                      }
                      action={
                        !debouncedQuery.trim() && statusFilter === 'all' ? (
                          <Button
                            onClick={() => {
                              setEditInitialTab('basic');
                              setEditTarget('new');
                            }}
                            disabled={!adminID}
                          >
                            <Plus className="h-4 w-4" />
                            Add used vehicle
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  const vStatus = Number(v.status);
                  return (
                    <tr key={v.id} className="align-top hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <UsedThumb vehicle={v} />
                          <div>
                            <div className="font-medium text-slate-900">
                              {v.model || '—'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {[v.variant, v.color, v.manufacturingYear]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {v.isElectric === 'Y' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                  <Zap className="h-2.5 w-2.5" />
                                  EV
                                </span>
                              )}
                              {v.driven && (
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {v.driven} km
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {v.ownership || '—'}
                        {v.location && (
                          <div className="text-slate-400">{v.location}</div>
                        )}
                        {v.loan && (
                          <div className="text-[11px] text-slate-400">
                            {v.loan}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {v.powerCC > 0 ? `${v.powerCC} cc` : '—'}
                        {v.vehicleType && (
                          <div className="text-slate-400">{v.vehicleType}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {v.priceRange || '—'}
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
                ? debouncedQuery.trim() || statusFilter !== 'all'
                  ? 'No matches.'
                  : 'No used vehicles.'
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

      <UsedVehicleEditModal
        target={editTarget}
        adminID={adminID}
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

function UsedThumb({ vehicle }) {
  // UsedVehicle entity uses lowercase `images` like the Vehicle entity.
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
