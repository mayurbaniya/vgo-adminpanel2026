import { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { UsedVehicles as UsedVehiclesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

// Canonical body-type list. Storage uses UPPER_SNAKE; labels are display-only.
// Mirrors testf/lib/pages/main/body_type_selection.dart. STREET / MOFET kept
// for back-compat with existing rows. ELECTRIC dropped — covered by isElectric.
const VEHICLE_TYPES = [
  { value: 'SPORTS', label: 'Sports' },
  { value: 'CRUISER', label: 'Cruiser' },
  { value: 'SCOOTER', label: 'Scooter' },
  { value: 'OFF_ROAD', label: 'Off-road' },
  { value: 'CAFE_RACER', label: 'Cafe Racer' },
  { value: 'STREET', label: 'Street' },
  { value: 'MOFET', label: 'Mofet' },
];
const OWNERSHIPS = ['First Owner', 'Second Owner', 'Third Owner', 'Fourth+ Owner'];
const LOAN_STATUSES = ['No Loan Availed', 'Active Loan', 'Closed Loan'];
const TYPE_OPTIONS = ['second-hand', 'new'];
const NO_IMAGE_SUFFIX = '/other/not-found.png';
const MAX_IMAGES_PER_UPLOAD = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function hasRealImage(url) {
  return Boolean(url) && !url.endsWith(NO_IMAGE_SUFFIX);
}

// All 18 booleans the DTO accepts — grouped for the Inspection tab.
const INSPECTION_GROUPS = [
  {
    title: 'Lights',
    items: [
      ['headlightWorking', 'Headlight working'],
      ['brakelightWorking', 'Brake light working'],
      ['frontIndicatorsWorking', 'Front indicators working'],
      ['rearIndicatorWorking', 'Rear indicators working'],
    ],
  },
  {
    title: 'Engine & battery',
    items: [
      ['engineHealthy', 'Engine healthy'],
      ['engineSwitchWorking', 'Engine switch working'],
      ['engineSoundHealthy', 'Engine sound healthy'],
      ['batteryHealthy', 'Battery healthy'],
      ['exhaustSmoke', 'Exhaust smoke (issue)'],
    ],
  },
  {
    title: 'Brakes & tyres',
    items: [
      // Note: backend field is `frontBrakesworking` — lowercase 'w' is a backend typo, kept as-is.
      ['frontBrakesworking', 'Front brakes working'],
      ['rearBrakesWorking', 'Rear brakes working'],
      ['frontTyreHealthy', 'Front tyre healthy'],
      ['rearTyreHealthy', 'Rear tyre healthy'],
    ],
  },
  {
    title: 'Body & controls',
    items: [
      ['kickWorking', 'Kick working'],
      ['kickStartExist', 'Kick start present'],
      ['speedometerWorking', 'Speedometer working'],
      ['gearPlateWorking', 'Gear plate working'],
      ['handleConditionHealthy', 'Handle condition healthy'],
    ],
  },
];

const EMPTY_FORM = {
  // basic
  model: '',
  manufacturingYear: '',
  color: '',
  variant: '',
  vehicleType: '',
  isElectric: 'N',
  priceRange: '',
  ownership: '',
  driven: '',
  loan: '',
  location: '',
  type: 'second-hand',
  // engine + performance
  powerCC: '',
  engineType: '',
  maxTorque: '',
  cylinderCount: '',
  startType: '',
  fuelCapacity: '',
  gearCount: '',
  fuelType: '',
  accelerationTime: '',
  mileageClaimed: '',
  mileageUser: '',
  topSpeed: '',
  frontBrake: '',
  rearBrake: '',
  brakingType: '',
  // features
  chargingPort: false,
  bluetooth: false,
  bootLight: false,
  i3sTechnology: false,
  keyType: '',
  description: '',
  // inspection booleans
  headlightWorking: false,
  engineHealthy: false,
  brakelightWorking: false,
  frontIndicatorsWorking: false,
  rearIndicatorWorking: false,
  engineSwitchWorking: false,
  kickWorking: false,
  kickStartExist: false,
  speedometerWorking: false,
  batteryHealthy: false,
  engineSoundHealthy: false,
  exhaustSmoke: false,
  gearPlateWorking: false,
  handleConditionHealthy: false,
  frontBrakesworking: false,
  rearBrakesWorking: false,
  frontTyreHealthy: false,
  rearTyreHealthy: false,
};

function vehicleToForm(v) {
  return {
    model: v.model ?? '',
    manufacturingYear: v.manufacturingYear ?? '',
    color: v.color ?? '',
    variant: v.variant ?? '',
    vehicleType: v.vehicleType ?? '',
    isElectric: v.isElectric ?? 'N',
    priceRange: v.priceRange ?? '',
    ownership: v.ownership ?? '',
    // Backend Java field is `Driven` (capital D), Lombok-generated getter
    // serializes JSON as `driven`. Read both just to be safe across casing.
    driven: v.driven ?? v.Driven ?? '',
    loan: v.loan ?? '',
    location: v.location ?? '',
    type: v.type ?? 'second-hand',
    powerCC: v.powerCC ?? '',
    engineType: v.engineType ?? '',
    maxTorque: v.maxTorque ?? '',
    cylinderCount: v.cylinderCount ?? '',
    startType: v.startType ?? '',
    fuelCapacity: v.fuelCapacity ?? '',
    gearCount: v.gearCount ?? '',
    fuelType: v.fuelType ?? '',
    accelerationTime: v.accelerationTime ?? '',
    mileageClaimed: v.mileageClaimed ?? '',
    mileageUser: v.mileageUser ?? '',
    topSpeed: v.topSpeed ?? '',
    frontBrake: v.frontBrake ?? '',
    rearBrake: v.rearBrake ?? '',
    brakingType: v.brakingType ?? '',
    chargingPort: !!v.chargingPort,
    bluetooth: !!v.bluetooth,
    bootLight: !!v.bootLight,
    i3sTechnology: !!v.i3sTechnology,
    keyType: v.keyType ?? '',
    description: v.description ?? '',
    headlightWorking: !!v.headlightWorking,
    engineHealthy: !!v.engineHealthy,
    brakelightWorking: !!v.brakelightWorking,
    frontIndicatorsWorking: !!v.frontIndicatorsWorking,
    rearIndicatorWorking: !!v.rearIndicatorWorking,
    engineSwitchWorking: !!v.engineSwitchWorking,
    kickWorking: !!v.kickWorking,
    kickStartExist: !!v.kickStartExist,
    speedometerWorking: !!v.speedometerWorking,
    batteryHealthy: !!v.batteryHealthy,
    engineSoundHealthy: !!v.engineSoundHealthy,
    exhaustSmoke: !!v.exhaustSmoke,
    gearPlateWorking: !!v.gearPlateWorking,
    handleConditionHealthy: !!v.handleConditionHealthy,
    frontBrakesworking: !!v.frontBrakesworking,
    rearBrakesWorking: !!v.rearBrakesWorking,
    frontTyreHealthy: !!v.frontTyreHealthy,
    rearTyreHealthy: !!v.rearTyreHealthy,
  };
}

function toIntOr(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
}

function formToDTO(form) {
  return {
    model: form.model.trim(),
    manufacturingYear: form.manufacturingYear.trim(),
    // Backend DTO field name is `Driven` (capital D). Send under both casings
    // so whichever Jackson resolves wins.
    Driven: form.driven.trim(),
    driven: form.driven.trim(),
    color: form.color.trim(),
    priceRange: form.priceRange.trim(),
    topSpeed: form.topSpeed.trim(),
    frontBrake: form.frontBrake.trim(),
    rearBrake: form.rearBrake.trim(),
    brakingType: form.brakingType.trim(),
    vehicleType: form.vehicleType,
    isElectric: form.isElectric,
    variant: form.variant.trim(),
    ownership: form.ownership.trim(),
    powerCC: toIntOr(form.powerCC),
    engineType: form.engineType.trim(),
    maxTorque: form.maxTorque.trim(),
    cylinderCount: toIntOr(form.cylinderCount),
    startType: form.startType.trim(),
    fuelCapacity: form.fuelCapacity.trim(),
    gearCount: toIntOr(form.gearCount),
    accelerationTime: form.accelerationTime.trim(),
    mileageClaimed: form.mileageClaimed.trim(),
    mileageUser: form.mileageUser.trim(),
    fuelType: form.fuelType.trim(),
    chargingPort: !!form.chargingPort,
    keyType: form.keyType.trim(),
    bluetooth: !!form.bluetooth,
    bootLight: !!form.bootLight,
    i3sTechnology: !!form.i3sTechnology,
    loan: form.loan.trim(),
    location: form.location.trim(),
    description: form.description.trim(),
    type: form.type,
    headlightWorking: !!form.headlightWorking,
    engineHealthy: !!form.engineHealthy,
    brakelightWorking: !!form.brakelightWorking,
    frontIndicatorsWorking: !!form.frontIndicatorsWorking,
    rearIndicatorWorking: !!form.rearIndicatorWorking,
    engineSwitchWorking: !!form.engineSwitchWorking,
    kickWorking: !!form.kickWorking,
    kickStartExist: !!form.kickStartExist,
    speedometerWorking: !!form.speedometerWorking,
    batteryHealthy: !!form.batteryHealthy,
    engineSoundHealthy: !!form.engineSoundHealthy,
    exhaustSmoke: !!form.exhaustSmoke,
    gearPlateWorking: !!form.gearPlateWorking,
    handleConditionHealthy: !!form.handleConditionHealthy,
    frontBrakesworking: !!form.frontBrakesworking,
    rearBrakesWorking: !!form.rearBrakesWorking,
    frontTyreHealthy: !!form.frontTyreHealthy,
    rearTyreHealthy: !!form.rearTyreHealthy,
  };
}

export default function UsedVehicleEditModal({
  target,
  adminID,
  initialTab = 'basic',
  onClose,
  onSaved,
}) {
  const open = target !== null;
  const isEdit = open && target !== 'new';
  const vehicle = isEdit ? target : null;

  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [images, setImages] = useState([]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSubmitting(false);
    setServerError('');
    if (isEdit) {
      setForm(vehicleToForm(vehicle));
      setImages(vehicle.images || []);
    } else {
      setForm(EMPTY_FORM);
      setImages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, initialTab]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  function validate() {
    if (!form.model.trim()) return 'Model is required (Basic tab).';
    return '';
  }

  async function handleSave(e) {
    e?.preventDefault();
    const v = validate();
    if (v) {
      setServerError(v);
      return;
    }
    if (!adminID && !isEdit) {
      setServerError('Admin session not loaded yet.');
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const body = formToDTO(form);
      const resp = isEdit
        ? await UsedVehiclesApi.update(vehicle.id, body)
        : await UsedVehiclesApi.create(adminID, body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save used vehicle.');
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to save used vehicle.',
      );
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const STANDALONE_TABS = new Set(['images']);
  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'engine', label: 'Engine & performance' },
    { id: 'features', label: 'Features' },
    { id: 'inspection', label: 'Inspection' },
    ...(isEdit ? [{ id: 'images', label: 'Images' }] : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      size="xl"
      title={
        isEdit
          ? `Edit used vehicle — ${vehicle.model || `#${vehicle.id}`}`
          : 'Add used vehicle'
      }
      footer={
        STANDALONE_TABS.has(tab) ? (
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="used-vehicle-edit-form"
              loading={submitting}
              disabled={submitting}
            >
              {isEdit ? 'Save changes' : 'Create vehicle'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="-mt-1 flex flex-wrap gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-xs font-semibold transition',
                tab === t.id
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'images' && isEdit ? (
          <ImagesPanel
            vehicleID={vehicle.id}
            images={images}
            onImagesChanged={setImages}
            onError={setServerError}
            error={serverError}
          />
        ) : (
          <form
            id="used-vehicle-edit-form"
            onSubmit={handleSave}
            className="space-y-4"
          >
            {tab === 'basic' && <BasicTab form={form} patch={patch} isEdit={isEdit} />}
            {tab === 'engine' && <EngineTab form={form} patch={patch} />}
            {tab === 'features' && <FeaturesTab form={form} patch={patch} />}
            {tab === 'inspection' && <InspectionTab form={form} patch={patch} />}

            {serverError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {serverError}
              </div>
            )}
            {!isEdit && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                Images can be added after creating the vehicle.
              </div>
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Tab panels
// -----------------------------------------------------------------------------

function BasicTab({ form, patch, isEdit }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Model *">
        <Input
          value={form.model}
          onChange={(e) => patch({ model: e.target.value })}
          placeholder="e.g. Classic 350"
          autoFocus={!isEdit}
        />
      </Field>
      <Field label="Manufacturing year">
        <Input
          value={form.manufacturingYear}
          onChange={(e) => patch({ manufacturingYear: e.target.value })}
          placeholder="e.g. 2022"
        />
      </Field>
      <Field label="Variant">
        <Input
          value={form.variant}
          onChange={(e) => patch({ variant: e.target.value })}
        />
      </Field>
      <Field label="Color">
        <Input
          value={form.color}
          onChange={(e) => patch({ color: e.target.value })}
        />
      </Field>
      <Field label="Body type">
        <Select
          value={form.vehicleType}
          onChange={(v) => patch({ vehicleType: v })}
          options={[
            { value: '', label: 'Select body type…' },
            ...VEHICLE_TYPES,
          ]}
        />
      </Field>
      <Field label="Electric?">
        <div className="flex gap-2">
          {['Y', 'N'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => patch({ isElectric: v })}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                form.isElectric === v
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {v === 'Y' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Driven (km)">
        <Input
          value={form.driven}
          onChange={(e) => patch({ driven: e.target.value })}
          placeholder="e.g. 18,500"
        />
      </Field>
      <Field label="Ownership">
        <Select
          value={form.ownership}
          onChange={(v) => patch({ ownership: v })}
          options={[
            { value: '', label: 'Select…' },
            ...OWNERSHIPS.map((o) => ({ value: o, label: o })),
          ]}
        />
      </Field>
      <Field label="Loan status">
        <Select
          value={form.loan}
          onChange={(v) => patch({ loan: v })}
          options={[
            { value: '', label: 'Select…' },
            ...LOAN_STATUSES.map((l) => ({ value: l, label: l })),
          ]}
        />
      </Field>
      <Field label="Listing type">
        <Select
          value={form.type}
          onChange={(v) => patch({ type: v })}
          options={TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
        />
      </Field>
      <Field label="Location" className="sm:col-span-2">
        <Input
          value={form.location}
          onChange={(e) => patch({ location: e.target.value })}
          placeholder="City / area / dealer"
        />
      </Field>
      <Field label="Price range" className="sm:col-span-2">
        <Input
          value={form.priceRange}
          onChange={(e) => patch({ priceRange: e.target.value })}
          placeholder="e.g. ₹1,30,000 - ₹1,40,000"
        />
      </Field>
    </div>
  );
}

function EngineTab({ form, patch }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Power (CC)">
        <Input
          type="number"
          value={form.powerCC}
          onChange={(e) => patch({ powerCC: e.target.value })}
        />
      </Field>
      <Field label="Engine type">
        <Input
          value={form.engineType}
          onChange={(e) => patch({ engineType: e.target.value })}
        />
      </Field>
      <Field label="Max torque">
        <Input
          value={form.maxTorque}
          onChange={(e) => patch({ maxTorque: e.target.value })}
        />
      </Field>
      <Field label="Cylinder count">
        <Input
          type="number"
          value={form.cylinderCount}
          onChange={(e) => patch({ cylinderCount: e.target.value })}
        />
      </Field>
      <Field label="Start type">
        <Input
          value={form.startType}
          onChange={(e) => patch({ startType: e.target.value })}
          placeholder="Self / Kick"
        />
      </Field>
      <Field label="Fuel capacity">
        <Input
          value={form.fuelCapacity}
          onChange={(e) => patch({ fuelCapacity: e.target.value })}
        />
      </Field>
      <Field label="Gear count">
        <Input
          type="number"
          value={form.gearCount}
          onChange={(e) => patch({ gearCount: e.target.value })}
        />
      </Field>
      <Field label="Fuel type">
        <Input
          value={form.fuelType}
          onChange={(e) => patch({ fuelType: e.target.value })}
        />
      </Field>
      <Field label="0–60 / acceleration">
        <Input
          value={form.accelerationTime}
          onChange={(e) => patch({ accelerationTime: e.target.value })}
        />
      </Field>
      <Field label="Top speed">
        <Input
          value={form.topSpeed}
          onChange={(e) => patch({ topSpeed: e.target.value })}
        />
      </Field>
      <Field label="Mileage (claimed)">
        <Input
          value={form.mileageClaimed}
          onChange={(e) => patch({ mileageClaimed: e.target.value })}
        />
      </Field>
      <Field label="Mileage (user)">
        <Input
          value={form.mileageUser}
          onChange={(e) => patch({ mileageUser: e.target.value })}
        />
      </Field>
      <Field label="Front brake">
        <Input
          value={form.frontBrake}
          onChange={(e) => patch({ frontBrake: e.target.value })}
        />
      </Field>
      <Field label="Rear brake">
        <Input
          value={form.rearBrake}
          onChange={(e) => patch({ rearBrake: e.target.value })}
        />
      </Field>
      <Field label="Braking type" className="sm:col-span-2">
        <Input
          value={form.brakingType}
          onChange={(e) => patch({ brakingType: e.target.value })}
        />
      </Field>
    </div>
  );
}

function FeaturesTab({ form, patch }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CheckboxRow
          label="Charging port (USB)"
          checked={form.chargingPort}
          onChange={(v) => patch({ chargingPort: v })}
        />
        <CheckboxRow
          label="Bluetooth"
          checked={form.bluetooth}
          onChange={(v) => patch({ bluetooth: v })}
        />
        <CheckboxRow
          label="Boot light"
          checked={form.bootLight}
          onChange={(v) => patch({ bootLight: v })}
        />
        <CheckboxRow
          label="i3S technology"
          checked={form.i3sTechnology}
          onChange={(v) => patch({ i3sTechnology: v })}
        />
      </div>
      <Field label="Key type">
        <Input
          value={form.keyType}
          onChange={(e) => patch({ keyType: e.target.value })}
          placeholder="Smart / Mechanical"
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Free-form notes about the listing — condition, accessories, dealer claims, etc."
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </Field>
    </div>
  );
}

function InspectionTab({ form, patch }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        Tick whichever items inspect OK. Anything left unchecked surfaces as a
        red flag in the listing's condition report.
      </div>
      {INSPECTION_GROUPS.map((group) => (
        <div
          key={group.title}
          className="rounded-xl border border-slate-200 p-3"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {group.title}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.items.map(([key, label]) => (
              <CheckboxRow
                key={key}
                label={label}
                checked={!!form[key]}
                onChange={(v) => patch({ [key]: v })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Images panel — uses UsedVehicles endpoints. Same UX as the new-vehicle one.
// -----------------------------------------------------------------------------
function ImagesPanel({ vehicleID, images, onImagesChanged, onError, error }) {
  const [uploading, setUploading] = useState(false);
  const [removingURL, setRemovingURL] = useState(null);
  const [removingAll, setRemovingAll] = useState(false);
  const fileInputRef = useRef(null);

  const realImages = (images || []).filter(hasRealImage);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > MAX_IMAGES_PER_UPLOAD) {
      onError(`Upload up to ${MAX_IMAGES_PER_UPLOAD} images at a time.`);
      return;
    }
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        onError(`"${f.name}" isn't an image.`);
        return;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        onError(`"${f.name}" exceeds the 5 MB soft limit.`);
        return;
      }
    }
    setUploading(true);
    onError('');
    try {
      const fd = new FormData();
      for (const f of files) fd.append('file', f);
      const resp = await UsedVehiclesApi.addImages(vehicleID, fd);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to upload images.');
      }
      const list = await UsedVehiclesApi.getImages(vehicleID);
      if (list?.data?.status === 'SUCCESS') {
        onImagesChanged(list.data.data || []);
      }
    } catch (err) {
      onError(
        err?.response?.data?.msg || err?.message || 'Failed to upload images.',
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveOne(imageURL) {
    const ok = window.confirm('Remove this image?');
    if (!ok) return;
    setRemovingURL(imageURL);
    onError('');
    try {
      const resp = await UsedVehiclesApi.removeImage(vehicleID, imageURL);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to remove image.');
      }
      onImagesChanged(images.filter((u) => u !== imageURL));
    } catch (err) {
      onError(
        err?.response?.data?.msg || err?.message || 'Failed to remove image.',
      );
    } finally {
      setRemovingURL(null);
    }
  }

  async function handleRemoveAll() {
    const ok = window.confirm(
      'Remove ALL images for this used vehicle? This can\'t be undone.',
    );
    if (!ok) return;
    setRemovingAll(true);
    onError('');
    try {
      const resp = await UsedVehiclesApi.removeAllImages(vehicleID);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to clear images.');
      }
      onImagesChanged([]);
    } catch (err) {
      onError(
        err?.response?.data?.msg || err?.message || 'Failed to clear images.',
      );
    } finally {
      setRemovingAll(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {realImages.length} image{realImages.length === 1 ? '' : 's'} ·
          {' '}up to {MAX_IMAGES_PER_UPLOAD} per upload, ≤ 5 MB each.
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
            disabled={uploading || removingAll}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
          {realImages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveAll}
              loading={removingAll}
              disabled={uploading || removingAll || removingURL !== null}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove all
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {realImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <ImageIcon className="mb-2 h-8 w-8 text-slate-300" />
          <div className="text-sm font-medium text-slate-600">
            No images yet
          </div>
        </div>
      ) : uploading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {realImages.map((url) => (
            <div
              key={url}
              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <img
                src={url}
                alt=""
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleRemoveOne(url)}
                disabled={removingURL === url || removingAll}
                className={cn(
                  'absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-red-600 shadow-soft transition',
                  'hover:bg-red-50',
                  removingURL === url && 'animate-pulse',
                )}
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tiny form helpers
// -----------------------------------------------------------------------------

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }) {
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

function CheckboxRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}
