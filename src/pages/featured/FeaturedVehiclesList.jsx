import { useEffect, useMemo, useState } from 'react';
import { Bike, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

const STATUS_ACTIVE = 1;
const NO_IMAGE_SUFFIX = '/other/not-found.png';

function hasRealImage(url) {
  return Boolean(url) && !url.endsWith(NO_IMAGE_SUFFIX);
}

export default function FeaturedVehiclesList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getFeatured()
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') {
          // Backend returns the FeaturedVehicles list (each has {id, priority, vehicle}).
          // Sort by priority ascending so the most-prominent slot is at the top.
          const list = (resp.data.data || []).slice().sort(
            (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
          );
          setItems(list);
          setError('');
        } else if (status === 'EMPTY') {
          setItems([]);
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load featured vehicles.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load featured vehicles.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reloadAll() {
    setReloadKey((k) => k + 1);
  }

  async function handleRemove(featured) {
    const ok = window.confirm(
      `Remove "${featured.vehicle?.model || 'this vehicle'}" from featured?`,
    );
    if (!ok) return;
    setRemovingId(featured.id);
    setError('');
    try {
      const resp = await VehiclesApi.removeFeatured(featured.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to remove featured vehicle.');
      }
      setItems((prev) => prev.filter((it) => it.id !== featured.id));
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to remove featured vehicle.',
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Featured vehicles"
        subtitle="Vehicles surfaced in the featured carousel on the consumer app."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add featured
          </Button>
        }
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
                <th className="px-4 py-3 w-20">Priority</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <EmptyState
                      icon={Sparkles}
                      title="No featured vehicles yet"
                      description="Pick which vehicles show in the featured carousel and order them by priority."
                      action={
                        <Button onClick={() => setAddOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Add featured
                        </Button>
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const v = it.vehicle || {};
                  const firstImage = (v.images || []).find(hasRealImage);
                  return (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-50 px-2 text-xs font-semibold text-brand-700">
                          {it.priority ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {firstImage ? (
                            <img
                              src={firstImage}
                              alt={v.model}
                              className="h-12 w-12 flex-shrink-0 rounded-md border border-slate-200 bg-white object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                              <Bike className="h-5 w-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">
                              {v.model || '—'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {[v.variant, v.color].filter(Boolean).join(' · ') ||
                                '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {v.brand?.name || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {v.price || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={removingId === it.id}
                            disabled={removingId !== null}
                            onClick={() => handleRemove(it)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
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
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          {loading
            ? 'Loading…'
            : items.length === 0
              ? 'No featured.'
              : `${items.length} featured vehicle${items.length === 1 ? '' : 's'}`}
        </div>
      </Card>

      <AddFeaturedModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingVehicleIDs={items
          .map((it) => it.vehicle?.id)
          .filter((id) => Number.isFinite(id))}
        onAdded={() => {
          setAddOpen(false);
          reloadAll();
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Add featured modal — debounced server-side vehicle search + priority input.
// Uses the same VehiclesApi.getAll pagination so admins can find vehicles by
// model/variant/color without loading the full catalog into memory.
// -----------------------------------------------------------------------------
function AddFeaturedModal({ open, onClose, existingVehicleIDs, onAdded }) {
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [priority, setPriority] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSearchInput('');
    setResults([]);
    setSelected(null);
    setPriority('1');
    setSubmitting(false);
    setServerError('');
  }, [open]);

  // Search active vehicles only — no point featuring a disabled or deleted one.
  useEffect(() => {
    if (!open) return;
    const q = debouncedQuery.trim();
    let cancelled = false;
    setSearching(true);
    VehiclesApi.getAll({
      page: 0,
      size: 25,
      sortBy: 'model',
      sortDir: 'asc',
      q: q || undefined,
      status: STATUS_ACTIVE,
    })
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
  }, [open, debouncedQuery]);

  const filteredResults = useMemo(
    () => results.filter((v) => !existingVehicleIDs.includes(v.id)),
    [results, existingVehicleIDs],
  );

  const priorityNum = Number(priority);
  const localError = (() => {
    if (!selected) return '';
    if (!Number.isFinite(priorityNum) || priorityNum <= 0)
      return 'Priority must be a positive integer.';
    return '';
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected || localError) return;
    setSubmitting(true);
    setServerError('');
    try {
      const resp = await VehiclesApi.addFeatured(selected.id, priorityNum);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to add featured vehicle.');
      }
      onAdded();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to add featured vehicle.',
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
      title="Add featured vehicle"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-featured-form"
            loading={submitting}
            disabled={submitting || !selected || Boolean(localError)}
          >
            Add featured
          </Button>
        </>
      }
    >
      <form id="add-featured-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="featured-search">Vehicle</Label>
          <Input
            id="featured-search"
            placeholder="Search active vehicles by model, variant, color…"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSelected(null);
            }}
            autoFocus
          />
        </div>

        {selected ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-brand-800">
                  {selected.model}
                </div>
                <div className="text-xs text-brand-700">
                  {[selected.variant, selected.color, selected.brand?.name]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-brand-700 underline"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            {searching ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                {debouncedQuery.trim()
                  ? 'No vehicles match. (Already-featured ones are hidden.)'
                  : 'Type to search vehicles.'}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredResults.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(v)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900">
                          {v.model}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {[v.variant, v.color, v.brand?.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      {v.price && (
                        <div className="text-xs text-slate-500">{v.price}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="featured-priority">Priority</Label>
          <Input
            id="featured-priority"
            type="number"
            min="1"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
          <div className="mt-1 text-[11px] text-slate-500">
            Lower numbers appear first in the featured carousel.
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
