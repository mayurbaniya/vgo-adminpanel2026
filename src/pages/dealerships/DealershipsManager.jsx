import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Dealerships as DealershipsApi, Cities as CitiesApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import { cn } from '@/lib/cn';

const STATUS_ACTIVE = 1;
const STATUS_DISABLED = 99;

export default function DealershipsManager() {
  const { isSuperAdmin } = useAuth();
  const [dealerships, setDealerships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDealership, setEditingDealership] = useState(null);
  const [mutatingId, setMutatingId] = useState(null);

  async function load() {
    try {
      const resp = await DealershipsApi.getAll();
      if (resp?.data?.status === 'SUCCESS') {
        setDealerships(resp.data.data || []);
        setError('');
      } else {
        throw new Error(resp?.data?.msg || 'Failed to load dealerships.');
      }
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to load dealerships.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(dealership) {
    const goingActive = dealership.status !== STATUS_ACTIVE;
    setMutatingId(dealership.id);
    setError('');
    try {
      const resp = goingActive
        ? await DealershipsApi.enable(dealership.id)
        : await DealershipsApi.disable(dealership.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update dealership.');
      }
      const updated = resp.data.data;
      setDealerships((prev) =>
        prev.map((d) => (d.id === dealership.id ? { ...d, status: updated.status } : d)),
      );
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to update dealership.');
    } finally {
      setMutatingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dealerships;
    return dealerships.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.city?.name?.toLowerCase().includes(q) ||
        d.address?.toLowerCase().includes(q),
    );
  }, [dealerships, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dealerships"
        subtitle="Branches per city. New leads route to their city's dealership; sales are recorded against one."
        actions={
          isSuperAdmin && (
            <Button
              onClick={() => {
                setEditingDealership(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add dealership
            </Button>
          )
        }
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search dealerships…"
              leftIcon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Dealership</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                {isSuperAdmin && <th className="px-4 py-3 text-right">Actions</th>}
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <EmptyState
                      icon={Building2}
                      title={dealerships.length === 0 ? 'No dealerships yet' : 'No matches'}
                      description={
                        dealerships.length === 0
                          ? 'Add a dealership per operating city so leads can route to it.'
                          : 'Try a different search.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((dealership) => (
                  <tr key={dealership.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">{dealership.name}</div>
                      {dealership.address && (
                        <div className="max-w-xs truncate text-xs text-slate-500" title={dealership.address}>
                          {dealership.address}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{dealership.city?.name || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500">{dealership.phone || '—'}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={dealership.status} />
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingDealership(dealership);
                              setEditorOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={dealership.status === STATUS_ACTIVE ? 'ghost' : 'secondary'}
                            loading={mutatingId === dealership.id}
                            disabled={mutatingId !== null}
                            onClick={() => handleToggle(dealership)}
                          >
                            {dealership.status === STATUS_ACTIVE ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DealershipEditorModal
        open={editorOpen}
        dealership={editingDealership}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          setEditorOpen(false);
          setLoading(true);
          await load();
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
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-amber-500')} />
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}

function DealershipEditorModal({ open, dealership, onClose, onSaved }) {
  const isEdit = Boolean(dealership);
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState({ name: '', cityID: '', address: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      name: dealership?.name || '',
      cityID: dealership?.city?.id ? String(dealership.city.id) : '',
      address: dealership?.address || '',
      phone: dealership?.phone || '',
    });
    setServerError('');
    setSubmitting(false);
    CitiesApi.getAll()
      .then((resp) => {
        if (resp?.data?.status === 'SUCCESS') {
          setCities((resp.data.data || []).filter((c) => c.status === STATUS_ACTIVE));
        }
      })
      .catch(() => {});
  }, [open, dealership]);

  const canSubmit = form.name.trim() && form.cityID;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        name: form.name.trim(),
        cityID: Number(form.cityID),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      };
      const resp = isEdit
        ? await DealershipsApi.update(dealership.id, body)
        : await DealershipsApi.create(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save dealership.');
      }
      await onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to save dealership.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title={isEdit ? `Edit ${dealership?.name}` : 'Add dealership'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="dealership-form"
            loading={submitting}
            disabled={submitting || !canSubmit}
          >
            {isEdit ? 'Save changes' : 'Add dealership'}
          </Button>
        </>
      }
    >
      <form id="dealership-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="dealership-name">Name</Label>
          <Input
            id="dealership-name"
            autoFocus
            placeholder="e.g. Asteron Motors Indiranagar"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="dealership-city">City</Label>
          <select
            id="dealership-city"
            value={form.cityID}
            onChange={(e) => setForm((f) => ({ ...f, cityID: e.target.value }))}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">Select a city…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="dealership-address">Address</Label>
          <Input
            id="dealership-address"
            placeholder="Street address (optional)"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            maxLength={300}
          />
        </div>
        <div>
          <Label htmlFor="dealership-phone">Phone</Label>
          <Input
            id="dealership-phone"
            placeholder="Contact number (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            maxLength={20}
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
