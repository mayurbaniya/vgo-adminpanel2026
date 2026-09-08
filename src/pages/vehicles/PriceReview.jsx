import { useEffect, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Brands as BrandsApi, Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';
import VehicleEditModal from './VehicleEditModal.jsx';

const NO_IMAGE_SUFFIX = '/other/not-found.png';
function hasRealImage(url) {
  return Boolean(url) && !url.endsWith(NO_IMAGE_SUFFIX);
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function daysSince(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/**
 * Vehicles whose price hasn't been confirmed in a while — same list
 * ScheduledStalePriceCheck emails to mail.admin every Sunday. Since prices
 * here are hand-entered (no external pricing API), this is the only signal
 * that a listing might be out of date.
 */
export default function PriceReview() {
  const [vehicles, setVehicles] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        // brand list only feeds the edit modal's dropdown — non-blocking
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getStalePrices({
      page,
      size: pageSize,
      sortBy: 'priceVerifiedAt',
      sortDir: 'asc',
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
          setMeta({ pageNumber: page, totalPages: 0, totalElements: 0, lastPage: true });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load price review.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load price review.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function handleMarkVerified(vehicle) {
    setMutatingId(vehicle.id);
    setError('');
    try {
      const resp = await VehiclesApi.markPriceVerified(vehicle.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to mark price as verified.');
      }
      // It no longer belongs in this list — drop it locally instead of a
      // full reload, and true up pagination if that emptied the last row.
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
      setMeta((m) => ({
        ...m,
        totalElements: Math.max(0, m.totalElements - 1),
      }));
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to mark price as verified.',
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
        title="Price Review"
        subtitle="Active vehicles whose price hasn't been confirmed recently — the same list emailed to the admin every Sunday."
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Last verified</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <EmptyState
                      icon={CheckCircle2}
                      title="Nothing needs a price check"
                      description="Every active vehicle's price has been confirmed recently."
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  const stale = daysSince(v.priceVerifiedAt);
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
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {v.brand?.name || '—'}
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
                        {v.priceVerifiedAt ? (
                          <>
                            <div className="text-slate-600">
                              {dateFormatter.format(new Date(v.priceVerifiedAt))}
                            </div>
                            <div className="text-[11px] font-semibold text-amber-600">
                              {stale}d ago
                            </div>
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            Never verified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={mutatingId !== null}
                            onClick={() => setEditTarget(v)}
                            title="Edit price"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={mutatingId === v.id}
                            disabled={mutatingId !== null}
                            onClick={() => handleMarkVerified(v)}
                            className="text-emerald-700 hover:bg-emerald-50"
                            title="Price checked — still correct"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark as updated
                          </Button>
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
                ? 'Nothing stale.'
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
        initialTab="basic"
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          // The save itself bumps priceVerifiedAt server-side whenever the
          // price actually changed — reload so a vehicle that's no longer
          // stale drops off this list.
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
      className={cn(
        'h-12 w-12 flex-shrink-0 rounded-md border border-slate-200 bg-white object-cover',
      )}
      loading="lazy"
    />
  );
}
