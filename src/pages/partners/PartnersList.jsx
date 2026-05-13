import { useEffect, useState } from 'react';
import {
  Ban,
  Building2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  Phone,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Partners as PartnersApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

// user.status.{active,disable} from application.properties
const STATUS_ACTIVE = 'ACTIVE';
const STATUS_DISABLED = 'DISABLED';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Joined' },
  { value: 'email', label: 'Email' },
];

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

export default function PartnersList() {
  const { user } = useAuth();
  const adminID = user?.id;

  const [partners, setPartners] = useState([]);
  const [counts, setCounts] = useState(null);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);

  // Reset to page 0 on search/filter change.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    PartnersApi.getAll({
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
          setPartners(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else if (status === 'EMPTY') {
          setPartners([]);
          setMeta({
            pageNumber: page,
            totalPages: 0,
            totalElements: 0,
            lastPage: true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load partners.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load partners.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, statusFilter, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    PartnersApi.countSummary()
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

  const showingFrom =
    meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0
      ? 0
      : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  const adminGuardError = !adminID
    ? 'Loading admin session… actions disabled until login data is available.'
    : '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partners"
        subtitle="Lead-provider partners (asteronX) and their accounts."
        actions={
          <Button onClick={() => setInviteOpen(true)} disabled={!adminID}>
            <UserPlus className="h-4 w-4" />
            Invite partner
          </Button>
        }
      />

      {counts && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CountChip label="Total" value={counts.totalPartners} />
          <CountChip
            label="Active"
            value={counts.activePartners}
            tone="emerald"
          />
          <CountChip
            label="Banned"
            value={counts.disabledPartners}
            tone="amber"
          />
        </div>
      )}

      {(error || adminGuardError) && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error || adminGuardError}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search name, email, or phone…"
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

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 text-xs">
          {[
            { value: 'all', label: 'All' },
            { value: STATUS_ACTIVE, label: 'Active' },
            { value: STATUS_DISABLED, label: 'Banned' },
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
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4, 5].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : partners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <EmptyState
                      icon={Building2}
                      title={
                        debouncedQuery.trim() || statusFilter !== 'all'
                          ? 'No partners match your filters'
                          : 'No partners yet'
                      }
                      description={
                        debouncedQuery.trim() || statusFilter !== 'all'
                          ? 'Try clearing the search or status filter.'
                          : 'Invite the first partner to start onboarding lead providers.'
                      }
                      action={
                        !debouncedQuery.trim() && statusFilter === 'all' ? (
                          <Button
                            onClick={() => setInviteOpen(true)}
                            disabled={!adminID}
                          >
                            <Plus className="h-4 w-4" />
                            Invite partner
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-slate-50/50">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">
                        {p.name || '—'}
                      </div>
                      {p.age > 0 && (
                        <div className="text-xs text-slate-400">{p.age}y</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {p.email && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="truncate">{p.email}</span>
                        </div>
                      )}
                      {p.phone && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{p.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      <div>{p.city || '—'}</div>
                      {p.pinCode > 0 && (
                        <div className="text-slate-400">{p.pinCode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(p.created)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPaymentTarget(p)}
                          disabled={!adminID}
                          title="Payment details"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setResetTarget(p)}
                          disabled={!adminID || p.status !== STATUS_ACTIVE}
                          title="Reset password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            p.status === STATUS_ACTIVE ? 'ghost' : 'secondary'
                          }
                          onClick={() => setBanTarget(p)}
                          disabled={!adminID}
                          className={
                            p.status === STATUS_ACTIVE
                              ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                              : ''
                          }
                        >
                          {p.status === STATUS_ACTIVE ? (
                            <>
                              <Ban className="h-3.5 w-3.5" />
                              Ban
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Unban
                            </>
                          )}
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
                ? debouncedQuery.trim() || statusFilter !== 'all'
                  ? 'No matches.'
                  : 'No partners.'
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

      <InviteWizard
        open={inviteOpen}
        adminID={adminID}
        onClose={() => setInviteOpen(false)}
        onCompleted={() => {
          setInviteOpen(false);
          reloadAll();
        }}
      />

      <BanModal
        partner={banTarget}
        adminID={adminID}
        onClose={() => setBanTarget(null)}
        onCompleted={() => {
          setBanTarget(null);
          reloadAll();
        }}
      />

      <ResetPasswordModal
        partner={resetTarget}
        adminID={adminID}
        onClose={() => setResetTarget(null)}
        onCompleted={() => setResetTarget(null)}
      />

      <PaymentDetailsModal
        partner={paymentTarget}
        adminID={adminID}
        onClose={() => setPaymentTarget(null)}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const map = {
    ACTIVE: { tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    DISABLED: { tone: 'bg-red-50 text-red-700', dot: 'bg-red-500', label: 'Banned' },
    DELETED: { tone: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  };
  const cfg = map[s] || { tone: 'bg-slate-50 text-slate-500', dot: 'bg-slate-300' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        cfg.tone,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label || (s ? s.charAt(0) + s.slice(1).toLowerCase() : '—')}
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
  const toneClasses = {
    brand: 'border-brand-100 bg-brand-50 text-brand-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
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

// -----------------------------------------------------------------------------
// Invite wizard — step 1: form, step 2: OTP entry.
//
// Backend flow:
//   POST /create-partner?adminID  body=UserReqDTO
//     → on SUCCESS, returns data:{clientID, user}; an OTP is emailed to the
//       partner's address. Server stores the form against `clientID` for 5min.
//   POST /verify-partner          body={clientID, OTP, adminID}
//     → on SUCCESS, persists the partner User and clears the staged form.
// There is no "resend" — if the OTP is lost, the admin starts over.
// -----------------------------------------------------------------------------
const EMPTY_FORM = {
  name: '',
  age: '',
  email: '',
  city: '',
  pinCode: '',
  phone: '',
  password: '',
};

function InviteWizard({ open, adminID, onClose, onCompleted }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [clientID, setClientID] = useState(null);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitting(false);
    setServerError('');
    setClientID(null);
    setOtp('');
  }, [open]);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required.';
    const ageNum = Number(form.age);
    if (!form.age || Number.isNaN(ageNum)) e.age = 'Required.';
    else if (ageNum < 18) e.age = 'Must be 18 or older.';
    if (!form.email.trim()) e.email = 'Required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Invalid email format.';
    if (!form.city.trim()) e.city = 'Required.';
    if (!/^\d{6}$/.test(form.pinCode)) e.pinCode = 'Must be 6 digits.';
    if (!/^\d{10}$/.test(form.phone)) e.phone = 'Must be 10 digits.';
    if ((form.password || '').length < 6)
      e.password = 'At least 6 characters.';
    return e;
  }

  async function handleSubmitForm(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        name: form.name.trim(),
        age: Number(form.age),
        email: form.email.trim(),
        city: form.city.trim(),
        pinCode: Number(form.pinCode),
        phone: form.phone.trim(),
        password: form.password,
      };
      const resp = await PartnersApi.create(adminID, body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to send OTP.');
      }
      const cid = resp.data.data?.clientID;
      if (!cid) throw new Error('Backend did not return a clientID.');
      setClientID(cid);
      setStep(2);
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to send OTP.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitOtp(ev) {
    ev.preventDefault();
    if (!/^\d{4}$/.test(otp)) {
      setServerError('Enter the 4-digit OTP.');
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const resp = await PartnersApi.verify({
        clientID,
        OTP: otp,
        adminID: String(adminID),
      });
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'OTP verification failed.');
      }
      onCompleted();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg ||
          err?.message ||
          'OTP verification failed.',
      );
    } finally {
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
      title={step === 1 ? 'Invite partner' : 'Verify OTP'}
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="partner-invite-form"
              loading={submitting}
              disabled={submitting}
            >
              Send OTP
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setStep(1);
                setOtp('');
                setServerError('');
              }}
              disabled={submitting}
              className="mr-auto"
            >
              ← Back to form
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="partner-otp-form"
              loading={submitting}
              disabled={submitting || !/^\d{4}$/.test(otp)}
            >
              Verify & create
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <form
          id="partner-invite-form"
          onSubmit={handleSubmitForm}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Full name" error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                placeholder="e.g. Rahul Sharma"
              />
            </FormField>
            <FormField label="Age" error={errors.age}>
              <Input
                type="number"
                min={18}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="18+"
              />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="rahul@example.com"
              />
            </FormField>
            <FormField label="Phone" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                  })
                }
                placeholder="10-digit number"
              />
            </FormField>
            <FormField label="City" error={errors.city}>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Bengaluru"
              />
            </FormField>
            <FormField label="Pincode" error={errors.pinCode}>
              <Input
                value={form.pinCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pinCode: e.target.value.replace(/\D/g, '').slice(0, 6),
                  })
                }
                placeholder="6-digit pincode"
              />
            </FormField>
            <FormField
              label="Initial password"
              error={errors.password}
              className="sm:col-span-2"
            >
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder="At least 6 characters"
              />
            </FormField>
          </div>
          <p className="text-[11px] text-slate-500">
            An OTP will be emailed to the partner. The partner shares the OTP
            with you, then you verify it on the next step to finalize the
            account.
          </p>
          {serverError && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {serverError}
            </div>
          )}
        </form>
      ) : (
        <form
          id="partner-otp-form"
          onSubmit={handleSubmitOtp}
          className="space-y-3"
        >
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            OTP sent to <strong>{form.email}</strong>. Valid for 5 minutes.
            There's no resend — if the partner can't read it back, cancel and
            start over.
          </div>
          <div>
            <Label htmlFor="partner-otp">4-digit OTP</Label>
            <Input
              id="partner-otp"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              placeholder="••••"
              className="tracking-[0.6em] text-center text-lg"
            />
          </div>
          {serverError && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {serverError}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

function FormField({ label, error, children, className }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {error && (
        <div className="mt-1 text-[11px] font-medium text-red-600">{error}</div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Ban / Unban modal — backend takes a `reason` string and emails the partner.
// One modal handles both directions, switching label based on partner status.
// -----------------------------------------------------------------------------
function BanModal({ partner, adminID, onClose, onCompleted }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = partner !== null;
  const isBanning = partner?.status === STATUS_ACTIVE;

  useEffect(() => {
    if (!open) return;
    setReason('');
    setSubmitting(false);
    setServerError('');
  }, [open, partner?.id]);

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!reason.trim()) {
      setServerError('A reason is required — it goes into the email.');
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        adminID: String(adminID),
        partnerID: String(partner.id),
        reason: reason.trim(),
      };
      const resp = isBanning
        ? await PartnersApi.ban(body)
        : await PartnersApi.unban(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(
          resp?.data?.msg || `Failed to ${isBanning ? 'ban' : 'unban'} partner.`,
        );
      }
      onCompleted();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg ||
          err?.message ||
          `Failed to ${isBanning ? 'ban' : 'unban'} partner.`,
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
      title={`${isBanning ? 'Ban' : 'Unban'} ${partner.name || 'partner'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="ban-partner-form"
            loading={submitting}
            disabled={submitting || !reason.trim()}
            className={isBanning ? 'bg-red-600 hover:bg-red-700' : undefined}
          >
            {isBanning ? 'Ban partner' : 'Unban partner'}
          </Button>
        </>
      }
    >
      <form id="ban-partner-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">
            {partner.name || '—'}
          </div>
          <div>{partner.email}</div>
        </div>
        <div>
          <Label htmlFor="ban-reason">
            {isBanning ? 'Reason for banning' : 'Reason / message'}
          </Label>
          <textarea
            id="ban-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isBanning
                ? 'Repeated policy violations…'
                : 'Reinstating after review…'
            }
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <div className="mt-1 text-[11px] text-slate-400">
            This message is included in the email sent to the partner.
          </div>
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

// -----------------------------------------------------------------------------
// Reset password modal — calls the existing endpoint that takes the new
// password as a *query string* parameter. That's a known security smell; the
// note in `endpoints.js` flags it for a future backend fix.
// -----------------------------------------------------------------------------
function ResetPasswordModal({ partner, adminID, onClose, onCompleted }) {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');

  const open = partner !== null;

  useEffect(() => {
    if (!open) return;
    setReason('');
    setPassword('');
    setConfirm('');
    setSubmitting(false);
    setServerError('');
    setSuccess('');
  }, [open, partner?.id]);

  const localError = (() => {
    if (!password) return '';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (confirm && confirm !== password) return 'Passwords do not match.';
    return '';
  })();

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!reason.trim()) {
      setServerError('A reason is required — it goes into the email.');
      return;
    }
    if (password.length < 6 || password !== confirm) {
      setServerError(localError || 'Check the password fields.');
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const resp = await PartnersApi.resetPassword({
        adminID,
        partnerMail: partner.email,
        reason: reason.trim(),
        password,
      });
      const status = resp?.data?.status;
      if (status === 'SUCCESS') {
        setSuccess('Password reset and emailed to the partner.');
        // close after a short pause so the success message is visible
        setTimeout(onCompleted, 900);
        return;
      }
      if (status === 'PARTIAL_SUCCESS') {
        setSuccess(
          'Password changed, but the email failed to send. Tell the partner directly.',
        );
        setTimeout(onCompleted, 1500);
        return;
      }
      throw new Error(resp?.data?.msg || 'Failed to reset password.');
    } catch (err) {
      setServerError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to reset password.',
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
      title={`Reset password — ${partner.name || partner.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="reset-password-form"
            loading={submitting}
            disabled={
              submitting ||
              !reason.trim() ||
              password.length < 6 ||
              password !== confirm
            }
          >
            Reset & email
          </Button>
        </>
      }
    >
      <form
        id="reset-password-form"
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">{partner.email}</div>
        </div>
        <div>
          <Label htmlFor="reset-reason">Reason</Label>
          <textarea
            id="reset-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Partner reported they couldn't sign in…"
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="reset-pw">New password</Label>
            <Input
              id="reset-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <Label htmlFor="reset-pw-confirm">Confirm</Label>
            <Input
              id="reset-pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <div className="text-[11px] text-slate-500">
          The new password is emailed to the partner. The partner can change it
          after logging back in.
        </div>
        {(localError || serverError) && !success && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError || localError}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            {success}
          </div>
        )}
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Read-only payment details modal. The backend returns Optional<PartnerPaymentDetails>
// so success may still carry no useful data; show a friendly empty state.
// -----------------------------------------------------------------------------
function PaymentDetailsModal({ partner, adminID, onClose }) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  const open = partner !== null;

  useEffect(() => {
    if (!open) {
      setDetails(null);
      setError('');
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    PartnersApi.paymentDetails(adminID, partner.id)
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') {
          // backend wraps the entity inside Optional; unwrap when present
          const data = resp.data.data;
          const unwrapped = data?.present ? data.value : data;
          setDetails(unwrapped || null);
        } else if (status === 'NOT_FOUND') {
          setDetails(null);
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load payment details.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load payment details.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, adminID, partner?.id]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Payment details — ${partner.name || partner.email}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      ) : !details ? (
        <EmptyState
          icon={QrCode}
          title="No payment details on file"
          description="The partner hasn't added UPI / payment details yet."
          className="border-0 bg-transparent py-6"
        />
      ) : (
        <div className="space-y-3 text-sm">
          <DetailRow label="UPI ID" value={details.upiID || '—'} />
          {details.qrCode && (
            <div>
              <Label>QR code</Label>
              <div className="mt-1 flex h-48 w-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {/^https?:\/\//.test(details.qrCode) ? (
                  <img
                    src={details.qrCode}
                    alt="UPI QR code"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="break-all px-3 text-xs text-slate-500">
                    {details.qrCode}
                  </span>
                )}
              </div>
            </div>
          )}
          <DetailRow label="Updated" value={formatDate(details.modified)} />
        </div>
      )}
    </Modal>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="col-span-2 text-slate-700">{value}</div>
    </div>
  );
}
