import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Cities as CitiesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

// Backend uses int status: 1 = active, 99 = disabled
// (configured via city.status.{active,disabled} in application.properties).
const STATUS_ACTIVE = 1;
const STATUS_DISABLED = 99;
const MAX_NAME_LENGTH = 15;

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

export default function CitiesManager() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [mutatingId, setMutatingId] = useState(null);

  async function loadCities() {
    try {
      const resp = await CitiesApi.getAll();
      const status = resp?.data?.status;
      if (status === 'SUCCESS') {
        setCities(resp.data.data || []);
        setError('');
      } else if (status === 'EMPTY') {
        setCities([]);
        setError('');
      } else {
        throw new Error(resp?.data?.msg || 'Failed to load cities.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to load cities.',
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    CitiesApi.getAll()
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') setCities(resp.data.data || []);
        else if (status === 'EMPTY') setCities([]);
        else throw new Error(resp?.data?.msg || 'Failed to load cities.');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load cities.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(city) {
    const goingToActive = city.status !== STATUS_ACTIVE;
    setMutatingId(city.id);
    setError('');
    try {
      const resp = goingToActive
        ? await CitiesApi.enable(city.id)
        : await CitiesApi.disable(city.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update city.');
      }
      const updated = resp.data.data;
      setCities((prev) =>
        prev.map((c) =>
          c.id === city.id
            ? { ...c, status: updated.status, modified: updated.modified ?? c.modified }
            : c,
        ),
      );
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to update city.',
      );
    } finally {
      setMutatingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cities.filter((c) => {
      if (statusFilter === 'active' && c.status !== STATUS_ACTIVE) return false;
      if (statusFilter === 'disabled' && c.status !== STATUS_DISABLED) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cities, query, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cities"
        subtitle="Cities surfaced for on-road price and local offers."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add city
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search cities…"
              leftIcon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <FilterPill
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              All
            </FilterPill>
            <FilterPill
              active={statusFilter === 'active'}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </FilterPill>
            <FilterPill
              active={statusFilter === 'disabled'}
              onClick={() => setStatusFilter('disabled')}
            >
              Disabled
            </FilterPill>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12">
                    {cities.length === 0 ? (
                      <EmptyState
                        icon={Building2}
                        title="No cities yet"
                        description="Add the first city to start surfacing local on-road prices."
                        action={
                          <Button onClick={() => setAddOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add city
                          </Button>
                        }
                        className="border-0 bg-transparent py-0"
                      />
                    ) : (
                      <div className="text-center text-sm text-slate-500">
                        No cities match your filters.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((city) => (
                  <tr key={city.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {city.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={city.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(city.modified)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant={
                          city.status === STATUS_ACTIVE ? 'ghost' : 'secondary'
                        }
                        loading={mutatingId === city.id}
                        disabled={mutatingId !== null}
                        onClick={() => handleToggle(city)}
                      >
                        {city.status === STATUS_ACTIVE ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <div>
            Showing {filtered.length} of {cities.length}
          </div>
        </div>
      </Card>

      <AddCityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingNames={cities.map((c) => c.name.toLowerCase())}
        onAdded={async () => {
          setAddOpen(false);
          await loadCities();
        }}
      />
    </div>
  );
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

function AddCityModal({ open, onClose, existingNames, onAdded }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setServerError('');
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = name.trim();
  const localError = (() => {
    if (!trimmed) return '';
    if (trimmed.length > MAX_NAME_LENGTH)
      return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
    if (existingNames.includes(trimmed.toLowerCase()))
      return 'A city with this name already exists.';
    return '';
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trimmed || localError) return;
    setSubmitting(true);
    setServerError('');
    try {
      const resp = await CitiesApi.add(trimmed);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to add city.');
      }
      await onAdded();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to add city.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title="Add city"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-city-form"
            loading={submitting}
            disabled={submitting || !trimmed || Boolean(localError)}
          >
            Add city
          </Button>
        </>
      }
    >
      <form id="add-city-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="city-name">City name</Label>
          <Input
            id="city-name"
            autoFocus
            placeholder="e.g. Bengaluru"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Up to {MAX_NAME_LENGTH} characters.</span>
            <span>
              {trimmed.length}/{MAX_NAME_LENGTH}
            </span>
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
