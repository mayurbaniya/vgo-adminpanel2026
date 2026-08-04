import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Sales as SalesApi, Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext.jsx';

// Shared between the Sales page (admin walk-in flow) and the Leads page
// (record-sale-from-lead flow, which works for every staff role because the
// lead already carries the customer and vehicle — no admin-only pickers).

export const EMPTY_SALE_FORM = {
  saleDate: '',
  deliveryDate: '',
  salePrice: '',
  paymentMethod: '',
  paymentStatus: 'Pending',
  transactionId: '',
  saleStatus: 'Completed',
  invoiceNumber: '',
  notes: '',
  earned: '',
  vehicleNumber: '',
  chesisNumber: '',
};

export function saleBodyFromForm(form) {
  return {
    saleDate: form.saleDate || null,
    deliveryDate: form.deliveryDate || null,
    salePrice: form.salePrice.trim(),
    paymentMethod: form.paymentMethod.trim(),
    paymentStatus: form.paymentStatus,
    transactionId: form.transactionId.trim(),
    saleStatus: form.saleStatus,
    invoiceNumber: form.invoiceNumber.trim(),
    notes: form.notes.trim(),
    earned: form.earned.trim(),
    vehicleNumber: form.vehicleNumber.trim(),
    chesisNumber: form.chesisNumber.trim(),
  };
}

// The sale field block used by add, edit, and record-from-lead.
// `full` (default) shows everything, for the super admin. `full={false}` is
// the sales-exec view: commission never appears (it's computed server-side
// from the vehicle's admin-configured commission), and the payment
// bookkeeping block is hidden.
export function SaleFields({ form, patch, full = true }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Sale price *</Label>
          <Input
            value={form.salePrice}
            onChange={(e) => patch({ salePrice: e.target.value })}
            placeholder="e.g. 250000.00"
          />
        </div>
        {full && (
          <div>
            <Label>Earned (commission)</Label>
            <Input
              value={form.earned}
              onChange={(e) => patch({ earned: e.target.value })}
              placeholder="auto-filled from vehicle commission"
            />
            <div className="mt-1 text-[11px] text-slate-400">
              Auto-computed from the vehicle's commission when it's set — this
              value is only used as a fallback.
            </div>
          </div>
        )}
        <div>
          <Label>Sale date</Label>
          <input
            type="date"
            value={form.saleDate}
            onChange={(e) => patch({ saleDate: e.target.value })}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <Label>Delivery date</Label>
          <input
            type="date"
            value={form.deliveryDate}
            onChange={(e) => patch({ deliveryDate: e.target.value })}
            className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        {full && (
          <>
            <div>
              <Label>Payment status</Label>
              <select
                value={form.paymentStatus}
                onChange={(e) => patch({ paymentStatus: e.target.value })}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {['Paid', 'Pending', 'Installments', 'Refunded'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Sale status</Label>
              <select
                value={form.saleStatus}
                onChange={(e) => patch({ saleStatus: e.target.value })}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {['Completed', 'Pending', 'Canceled'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Payment method</Label>
              <Input
                value={form.paymentMethod}
                onChange={(e) => patch({ paymentMethod: e.target.value })}
                placeholder="Cash / Bank Transfer / EMI"
              />
            </div>
            <div>
              <Label>Transaction ID</Label>
              <Input
                value={form.transactionId}
                onChange={(e) => patch({ transactionId: e.target.value })}
                placeholder="Bank / UPI ref"
              />
            </div>
          </>
        )}
        <div>
          <Label>Invoice number</Label>
          <Input
            value={form.invoiceNumber}
            onChange={(e) => patch({ invoiceNumber: e.target.value })}
          />
        </div>
        {full && (
          // Hidden on the exec's close-lead form: brand-new vehicles don't
          // have a registration number at delivery time.
          <div>
            <Label>Vehicle number</Label>
            <Input
              value={form.vehicleNumber}
              onChange={(e) => patch({ vehicleNumber: e.target.value })}
              placeholder="Reg. plate"
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Chassis number</Label>
          <Input
            value={form.chesisNumber}
            onChange={(e) => patch({ chesisNumber: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Anything worth recording about this sale…"
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
    </div>
  );
}

// Record the sale for one specific lead: customer, vehicle, and the lead link
// come from the lead itself, so this works for SALES_EXEC and CITY_MANAGER
// (the Sales-page pickers need admin-only search endpoints). Saving marks the
// lead WON server-side.
export function RecordSaleFromLeadModal({ lead, onClose, onSaved }) {
  const { isSuperAdmin } = useAuth();
  const open = lead !== null;
  const [form, setForm] = useState(EMPTY_SALE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_SALE_FORM });
    setSubmitting(false);
    setServerError('');

    // Prefill the sale price with the vehicle's on-road price for the lead's
    // city (editable — the negotiated figure may differ). Best-effort: no
    // city or no price configured just leaves the field blank.
    if (!lead?.vehicle?.id || !lead?.cityID) return;
    let cancelled = false;
    VehiclesApi.userOnRoadPrice(lead.vehicle.id, lead.cityID)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status !== 'SUCCESS') return;
        const raw = resp.data.data?.onRoadPrice;
        const numeric = String(raw ?? '').replace(/[^\d.]/g, '');
        if (numeric) {
          setForm((f) => (f.salePrice === '' ? { ...f, salePrice: numeric } : f));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, lead?.interestID]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  const canSubmit = form.salePrice.trim() !== '' && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || !lead) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        userID: lead.user?.id,
        vehicleID: lead.vehicle?.id,
        leadID: lead.interestID,
        ...saleBodyFromForm(form),
      };
      const resp = await SalesApi.add(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to record sale.');
      }
      onSaved(resp.data.data);
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to record sale.',
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
      title={`Record sale — lead #${lead.interestID}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="record-sale-from-lead-form"
            loading={submitting}
            disabled={!canSubmit}
          >
            Record sale &amp; mark WON
          </Button>
        </>
      }
    >
      <form
        id="record-sale-from-lead-form"
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs text-emerald-800">
          <div className="font-semibold">
            {lead.user?.name || '—'} · {lead.vehicle?.model || '—'}
          </div>
          <div>
            Customer and vehicle come from the lead. Saving links the sale and
            moves the lead to WON.
          </div>
        </div>
        <SaleFields form={form} patch={patch} full={isSuperAdmin} />
        {serverError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
