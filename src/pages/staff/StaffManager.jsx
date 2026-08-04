import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import {
  Staff as StaffApi,
  Cities as CitiesApi,
  Dealerships as DealershipsApi,
} from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

const ROLES = [
  { value: 'CITY_MANAGER', label: 'City Manager' },
  { value: 'SALES_EXEC', label: 'Sales Executive' },
];

export default function StaffManager() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [mutatingId, setMutatingId] = useState(null);

  async function load() {
    try {
      const resp = await StaffApi.getAll({ page: 0, size: 100 });
      if (resp?.data?.status === 'SUCCESS') {
        setStaff(resp.data.data?.content || []);
        setError('');
      } else {
        throw new Error(resp?.data?.msg || 'Failed to load staff.');
      }
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to load staff.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle(member) {
    const goingActive = member.status !== 'ACTIVE';
    setMutatingId(member.id);
    setError('');
    try {
      const resp = goingActive
        ? await StaffApi.enable(member.id)
        : await StaffApi.disable(member.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update staff member.');
      }
      const updated = resp.data.data;
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, status: updated.status } : s)));
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to update staff member.');
    } finally {
      setMutatingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.staffCity?.name?.toLowerCase().includes(q) ||
        s.dealership?.name?.toLowerCase().includes(q),
    );
  }, [staff, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Scoped accounts for other cities: city managers see their city's leads and sales, sales executives their dealership's."
        actions={
          <Button
            onClick={() => {
              setEditingStaff(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add staff
          </Button>
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
              placeholder="Search staff…"
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
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Status</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <EmptyState
                      icon={ShieldCheck}
                      title={staff.length === 0 ? 'No staff accounts yet' : 'No matches'}
                      description={
                        staff.length === 0
                          ? 'Create scoped accounts instead of sharing the main admin credentials.'
                          : 'Try a different search.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {member.role === 'SALES_EXEC'
                        ? member.dealership
                          ? `${member.dealership.name} (${member.dealership.city?.name || '—'})`
                          : '—'
                        : member.staffCity?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          member.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700',
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            member.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500',
                          )}
                        />
                        {member.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingStaff(member);
                            setEditorOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={member.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                          loading={mutatingId === member.id}
                          disabled={mutatingId !== null}
                          onClick={() => handleToggle(member)}
                        >
                          {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StaffEditorModal
        open={editorOpen}
        member={editingStaff}
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

function RoleBadge({ role }) {
  const label = ROLES.find((r) => r.value === role)?.label || role;
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        role === 'CITY_MANAGER' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700',
      )}
    >
      {label}
    </span>
  );
}

function StaffEditorModal({ open, member, onClose, onSaved }) {
  const isEdit = Boolean(member);
  const [cities, setCities] = useState([]);
  const [dealerships, setDealerships] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'SALES_EXEC',
    cityID: '',
    dealershipID: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      name: member?.name || '',
      email: member?.email || '',
      phone: member?.phone || '',
      password: '',
      role: member?.role || 'SALES_EXEC',
      cityID: member?.staffCity?.id ? String(member.staffCity.id) : '',
      dealershipID: member?.dealership?.id ? String(member.dealership.id) : '',
    });
    setServerError('');
    setSubmitting(false);
    CitiesApi.getAll()
      .then((resp) => {
        if (resp?.data?.status === 'SUCCESS') {
          setCities((resp.data.data || []).filter((c) => c.status === 1));
        }
      })
      .catch(() => {});
    DealershipsApi.getAll()
      .then((resp) => {
        if (resp?.data?.status === 'SUCCESS') {
          setDealerships((resp.data.data || []).filter((d) => d.status === 1));
        }
      })
      .catch(() => {});
  }, [open, member]);

  const canSubmit =
    form.name.trim() &&
    (isEdit || (form.email.trim() && form.password.length >= 8)) &&
    (form.role === 'CITY_MANAGER' ? form.cityID : form.dealershipID);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password || null,
        role: form.role,
        cityID: form.role === 'CITY_MANAGER' ? Number(form.cityID) : null,
        dealershipID: form.role === 'SALES_EXEC' ? Number(form.dealershipID) : null,
      };
      const resp = isEdit
        ? await StaffApi.update(member.id, body)
        : await StaffApi.create(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save staff member.');
      }
      await onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to save staff member.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      size="lg"
      title={isEdit ? `Edit ${member?.name}` : 'Add staff member'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="staff-form"
            loading={submitting}
            disabled={submitting || !canSubmit}
          >
            {isEdit ? 'Save changes' : 'Create account'}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="staff-phone">Phone</Label>
            <Input
              id="staff-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={form.email}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="staff-password">
              {isEdit ? 'New password (blank = unchanged)' : 'Password (min 8 chars)'}
            </Label>
            <Input
              id="staff-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="staff-role">Role</Label>
            <select
              id="staff-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {form.role === 'CITY_MANAGER' ? (
            <div>
              <Label htmlFor="staff-city">City</Label>
              <select
                id="staff-city"
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
          ) : (
            <div>
              <Label htmlFor="staff-dealership">Dealership</Label>
              <select
                id="staff-dealership"
                value={form.dealershipID}
                onChange={(e) => setForm((f) => ({ ...f, dealershipID: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Select a dealership…</option>
                {dealerships.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city?.name || '—'})
                  </option>
                ))}
              </select>
            </div>
          )}
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
