import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Cities as CitiesApi, Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';
import ColoursPanel from './ColoursPanel.jsx';

// Canonical body-type list. Storage uses UPPER_SNAKE; labels are display-only.
// Mirrors testf/lib/pages/main/body_type_selection.dart so consumer-side filters
// match what admins set here. STREET and MOFET are kept for back-compat with
// existing rows (the user-side repo has findAllMofet/findAllExceptMofet queries
// that key on MOFET). ELECTRIC was dropped — the isElectric Y/N field covers it.
const VEHICLE_TYPES = [
  { value: 'SPORTS', label: 'Sports' },
  { value: 'CRUISER', label: 'Cruiser' },
  { value: 'SCOOTER', label: 'Scooter' },
  { value: 'OFF_ROAD', label: 'Off-road' },
  { value: 'CAFE_RACER', label: 'Cafe Racer' },
  { value: 'STREET', label: 'Street' },
  { value: 'MOFET', label: 'Mofet' },
];
const TYRE_TYPES = ['Tubeless', 'Tube'];
const NO_IMAGE_SUFFIX = '/other/not-found.png';
const MAX_IMAGES_PER_UPLOAD = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // backend doesn't enforce per-file, soft cap

function hasRealImage(url) {
  return Boolean(url) && !url.endsWith(NO_IMAGE_SUFFIX);
}

const EMPTY_FORM = {
  // basic
  model: '',
  manufacturingYear: '',
  color: '',
  variant: '',
  brandId: '',
  vehicleType: '',
  isElectric: 'N',
  launchDate: '',
  priceRange: '',
  price: '',
  // EV specs — only sent/shown when isElectric === 'Y'
  batteryCapacity: '',
  batteryType: '',
  certifiedRange: '',
  chargingTimeStandard: '',
  chargingTimeFast: '',
  fastCharging: false,
  motorPower: '',
  motorType: '',
  batteryWarranty: '',
  ridingModes: '',
  regenerativeBraking: false,
  // engine + performance
  powerCC: '',
  engineType: '',
  maxTorque: '',
  cylinderCount: '',
  startType: '',
  fuelCapacity: '',
  gearCount: '',
  fuelType: '',
  stroke: '',
  reserveFuelCapacity: '',
  accelerationTime: '',
  mileageClaimed: '',
  mileageUser: '',
  topSpeed: '',
  frontBrake: '',
  rearBrake: '',
  brakingType: '',
  // body
  wheelsType: '',
  frontWheelSize: '',
  rearWheelSize: '',
  tyreType: '',
  weight: '',
  seatHeight: '',
  chassisType: '',
  overallHeight: '',
  seatType: '',
  // features + service
  chargingPort: false,
  bluetooth: false,
  bootLight: false,
  i3sTechnology: false,
  keyType: '',
  freeServiceCount: '',
  firstServiceKM: '',
  firstServiceDays: '',
  secondServiceKM: '',
  secondServiceDays: '',
};

function vehicleToForm(v) {
  return {
    model: v.model ?? '',
    manufacturingYear: v.manufacturingYear ?? '',
    color: v.color ?? '',
    variant: v.variant ?? '',
    brandId: v.brand?.id ?? '',
    vehicleType: v.vehicleType ?? '',
    isElectric: v.isElectric ?? 'N',
    // Backend sends LocalDate as "YYYY-MM-DD", which <input type="date">
    // consumes directly. Guard the slice in case it ever arrives as a full
    // ISO datetime.
    launchDate: v.launchDate ? String(v.launchDate).slice(0, 10) : '',
    priceRange: v.priceRange ?? '',
    price: v.price ?? '',
    batteryCapacity: v.batteryCapacity ?? '',
    batteryType: v.batteryType ?? '',
    certifiedRange: v.certifiedRange ?? '',
    chargingTimeStandard: v.chargingTimeStandard ?? '',
    chargingTimeFast: v.chargingTimeFast ?? '',
    fastCharging: !!v.fastCharging,
    motorPower: v.motorPower ?? '',
    motorType: v.motorType ?? '',
    batteryWarranty: v.batteryWarranty ?? '',
    ridingModes: v.ridingModes ?? '',
    regenerativeBraking: !!v.regenerativeBraking,
    powerCC: v.powerCC ?? '',
    engineType: v.engineType ?? '',
    maxTorque: v.maxTorque ?? '',
    cylinderCount: v.cylinderCount ?? '',
    startType: v.startType ?? '',
    fuelCapacity: v.fuelCapacity ?? '',
    gearCount: v.gearCount ?? '',
    fuelType: v.fuelType ?? '',
    stroke: v.stroke ?? '',
    reserveFuelCapacity: v.reserveFuelCapacity ?? '',
    accelerationTime: v.accelerationTime ?? '',
    mileageClaimed: v.mileageClaimed ?? '',
    mileageUser: v.mileageUser ?? '',
    topSpeed: v.topSpeed ?? '',
    frontBrake: v.frontBrake ?? '',
    rearBrake: v.rearBrake ?? '',
    brakingType: v.brakingType ?? '',
    wheelsType: v.wheelsType ?? '',
    frontWheelSize: v.frontWheelSize ?? '',
    rearWheelSize: v.rearWheelSize ?? '',
    tyreType: v.tyreType ?? '',
    weight: v.weight ?? '',
    seatHeight: v.seatHeight ?? '',
    chassisType: v.chassisType ?? '',
    overallHeight: v.overallHeight ?? '',
    seatType: v.seatType ?? '',
    chargingPort: !!v.chargingPort,
    bluetooth: !!v.bluetooth,
    bootLight: !!v.bootLight,
    i3sTechnology: !!v.i3sTechnology,
    keyType: v.keyType ?? '',
    freeServiceCount: v.freeServiceCount ?? '',
    firstServiceKM: v.firstServiceKM ?? '',
    firstServiceDays: v.firstServiceDays ?? '',
    secondServiceKM: v.secondServiceKM ?? '',
    secondServiceDays: v.secondServiceDays ?? '',
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
    color: form.color.trim(),
    variant: form.variant.trim(),
    brandId: toIntOr(form.brandId),
    vehicleType: form.vehicleType,
    isElectric: form.isElectric,
    // Send null rather than '' when unset — Jackson rejects '' for LocalDate,
    // and null is the correct "never show in Newly Launched" value.
    launchDate: form.launchDate || null,
    priceRange: form.priceRange.trim(),
    price: form.price.trim(),
    // Both blocks are always sent, never cleared on toggle — the app decides
    // which to display from isElectric, and silently wiping the other block
    // would destroy data if someone flipped the switch by mistake.
    batteryCapacity: form.batteryCapacity.trim(),
    batteryType: form.batteryType.trim(),
    certifiedRange: form.certifiedRange.trim(),
    chargingTimeStandard: form.chargingTimeStandard.trim(),
    chargingTimeFast: form.chargingTimeFast.trim(),
    fastCharging: !!form.fastCharging,
    motorPower: form.motorPower.trim(),
    motorType: form.motorType.trim(),
    batteryWarranty: form.batteryWarranty.trim(),
    ridingModes: form.ridingModes.trim(),
    regenerativeBraking: !!form.regenerativeBraking,
    powerCC: toIntOr(form.powerCC),
    engineType: form.engineType.trim(),
    maxTorque: form.maxTorque.trim(),
    cylinderCount: toIntOr(form.cylinderCount),
    startType: form.startType.trim(),
    fuelCapacity: form.fuelCapacity.trim(),
    gearCount: toIntOr(form.gearCount),
    fuelType: form.fuelType.trim(),
    stroke: form.stroke.trim(),
    reserveFuelCapacity: form.reserveFuelCapacity.trim(),
    accelerationTime: form.accelerationTime.trim(),
    mileageClaimed: form.mileageClaimed.trim(),
    mileageUser: form.mileageUser.trim(),
    topSpeed: form.topSpeed.trim(),
    frontBrake: form.frontBrake.trim(),
    rearBrake: form.rearBrake.trim(),
    brakingType: form.brakingType.trim(),
    wheelsType: form.wheelsType.trim(),
    frontWheelSize: form.frontWheelSize.trim(),
    rearWheelSize: form.rearWheelSize.trim(),
    tyreType: form.tyreType,
    weight: form.weight.trim(),
    seatHeight: form.seatHeight.trim(),
    chassisType: form.chassisType.trim(),
    overallHeight: form.overallHeight.trim(),
    seatType: form.seatType.trim(),
    chargingPort: !!form.chargingPort,
    bluetooth: !!form.bluetooth,
    bootLight: !!form.bootLight,
    i3sTechnology: !!form.i3sTechnology,
    keyType: form.keyType.trim(),
    freeServiceCount: toIntOr(form.freeServiceCount),
    firstServiceKM: form.firstServiceKM.trim(),
    firstServiceDays: form.firstServiceDays.trim(),
    secondServiceKM: form.secondServiceKM.trim(),
    secondServiceDays: form.secondServiceDays.trim(),
  };
}

export default function VehicleEditModal({
  target,
  brands,
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

  // local copy of vehicle.images so the Images tab stays in sync after upload/remove
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
    // intentionally watching only target+initialTab — vehicle is derived from target
  }, [target, initialTab]);

  function patch(next) {
    setForm((f) => ({ ...f, ...next }));
  }

  function validateForSubmit() {
    if (!form.model.trim()) return 'Model is required (Basic tab).';
    if (!form.brandId) return 'Brand is required (Basic tab).';
    return '';
  }

  async function handleSave(ev) {
    ev?.preventDefault();
    const v = validateForSubmit();
    if (v) {
      setServerError(v);
      return;
    }
    setSubmitting(true);
    setServerError('');
    try {
      const body = formToDTO(form);
      if (isEdit) {
        // Brand changes are a separate endpoint on this backend.
        const newBrandId = body.brandId;
        const oldBrandId = vehicle.brand?.id;
        if (newBrandId && oldBrandId && newBrandId !== oldBrandId) {
          const cb = await VehiclesApi.changeBrand(vehicle.id, newBrandId);
          if (cb?.data?.status !== 'SUCCESS') {
            throw new Error(cb?.data?.msg || 'Failed to change brand.');
          }
        }
        const resp = await VehiclesApi.update(vehicle.id, body);
        if (resp?.data?.status !== 'SUCCESS') {
          throw new Error(resp?.data?.msg || 'Failed to update vehicle.');
        }
      } else {
        const resp = await VehiclesApi.create(body);
        if (resp?.data?.status !== 'SUCCESS') {
          throw new Error(resp?.data?.msg || 'Failed to create vehicle.');
        }
      }
      onSaved();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to save vehicle.',
      );
      setSubmitting(false);
    }
  }

  if (!open) return null;

  // Tabs that need their own write path (don't share the main vehicle-edit form)
  // — they're edit-only because each requires an existing vehicleID for its API.
  const STANDALONE_TABS = new Set(['images', 'pricing', 'videos', 'colours']);
  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'engine', label: 'Engine & performance' },
    { id: 'body', label: 'Body' },
    { id: 'features', label: 'Features & service' },
    ...(isEdit
      ? [
          { id: 'images', label: 'Images' },
          { id: 'colours', label: 'Colours' },
          { id: 'pricing', label: 'Pricing' },
          { id: 'videos', label: 'Videos' },
        ]
      : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      size="xl"
      title={isEdit ? `Edit vehicle — ${vehicle.model}` : 'Add vehicle'}
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
              form="vehicle-edit-form"
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
        {/* Tab strip */}
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
        ) : tab === 'colours' && isEdit ? (
          <ColoursPanel vehicleID={vehicle.id} />
        ) : tab === 'pricing' && isEdit ? (
          <PricingPanel vehicleID={vehicle.id} />
        ) : tab === 'videos' && isEdit ? (
          <VideosPanel vehicleID={vehicle.id} />
        ) : (
          <form
            id="vehicle-edit-form"
            onSubmit={handleSave}
            className="space-y-4"
          >
            {tab === 'basic' && (
              <BasicTab form={form} patch={patch} brands={brands} isEdit={isEdit} />
            )}
            {tab === 'engine' && <EngineTab form={form} patch={patch} />}
            {tab === 'body' && <BodyTab form={form} patch={patch} />}
            {tab === 'features' && <FeaturesTab form={form} patch={patch} />}

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

function BasicTab({ form, patch, brands, isEdit }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Model *" >
        <Input
          value={form.model}
          onChange={(e) => patch({ model: e.target.value })}
          placeholder="e.g. Classic 350"
          autoFocus={!isEdit}
        />
      </Field>
      <Field label="Brand *">
        <Select
          value={form.brandId}
          onChange={(v) => patch({ brandId: Number(v) || '' })}
          options={[
            { value: '', label: 'Select brand…' },
            ...brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      </Field>
      <Field label="Variant">
        <Input
          value={form.variant}
          onChange={(e) => patch({ variant: e.target.value })}
          placeholder="e.g. Halcyon"
        />
      </Field>
      <Field label="Color">
        <Input
          value={form.color}
          onChange={(e) => patch({ color: e.target.value })}
        />
      </Field>
      <Field label="Manufacturing year">
        <Input
          value={form.manufacturingYear}
          onChange={(e) => patch({ manufacturingYear: e.target.value })}
          placeholder="e.g. 2025"
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
      <Field label="Launch date">
        <Input
          type="date"
          value={form.launchDate}
          onChange={(e) => patch({ launchDate: e.target.value })}
        />
        <p className="mt-1 text-xs text-slate-500">
          The app’s “Newly Launched” section shows vehicles launched in the
          last 90 days. A future date shows nothing until that day arrives.
          Leave blank to keep this vehicle out of the section.
        </p>
      </Field>
      <Field label="Price">
        <Input
          value={form.price}
          onChange={(e) => patch({ price: e.target.value })}
          placeholder="e.g. ₹2,15,000"
        />
      </Field>
      <Field label="Price range" className="sm:col-span-2">
        <Input
          value={form.priceRange}
          onChange={(e) => patch({ priceRange: e.target.value })}
          placeholder="e.g. ₹2,15,000 - ₹2,40,000"
        />
      </Field>
    </div>
  );
}

// Powertrain fields split by isElectric. Only one block is ever shown, so an
// EV record is never presented with a Fuel capacity box to leave blank — the
// gap that left EV listings looking half-filled in the app.
function ElectricPowertrainFields({ form, patch }) {
  return (
    <>
      <Field label="Battery capacity">
        <Input
          value={form.batteryCapacity}
          onChange={(e) => patch({ batteryCapacity: e.target.value })}
          placeholder="e.g. 3.2 kWh"
        />
      </Field>
      <Field label="Battery type">
        <Input
          value={form.batteryType}
          onChange={(e) => patch({ batteryType: e.target.value })}
          placeholder="e.g. Lithium-ion"
        />
      </Field>
      <Field label="Certified range">
        <Input
          value={form.certifiedRange}
          onChange={(e) => patch({ certifiedRange: e.target.value })}
          placeholder="e.g. 150 km"
        />
      </Field>
      <Field label="Motor power">
        <Input
          value={form.motorPower}
          onChange={(e) => patch({ motorPower: e.target.value })}
          placeholder="e.g. 6.4 kW"
        />
      </Field>
      <Field label="Motor type">
        <Input
          value={form.motorType}
          onChange={(e) => patch({ motorType: e.target.value })}
          placeholder="e.g. BLDC Hub"
        />
      </Field>
      <Field label="Charging time (standard)">
        <Input
          value={form.chargingTimeStandard}
          onChange={(e) => patch({ chargingTimeStandard: e.target.value })}
          placeholder="e.g. 4h 30m"
        />
      </Field>
      <Field label="Charging time (fast)">
        <Input
          value={form.chargingTimeFast}
          onChange={(e) => patch({ chargingTimeFast: e.target.value })}
          placeholder="e.g. 1h (0–80%)"
        />
      </Field>
      <Field label="Battery warranty">
        <Input
          value={form.batteryWarranty}
          onChange={(e) => patch({ batteryWarranty: e.target.value })}
          placeholder="e.g. 3 years / 30,000 km"
        />
      </Field>
      <Field label="Riding modes" className="sm:col-span-2">
        <Input
          value={form.ridingModes}
          onChange={(e) => patch({ ridingModes: e.target.value })}
          placeholder="e.g. Eco, City, Sport"
        />
      </Field>
      <CheckboxRow
        label="Fast charging supported"
        checked={form.fastCharging}
        onChange={(v) => patch({ fastCharging: v })}
      />
      <CheckboxRow
        label="Regenerative braking"
        checked={form.regenerativeBraking}
        onChange={(v) => patch({ regenerativeBraking: v })}
      />
    </>
  );
}

function CombustionPowertrainFields({ form, patch }) {
  return (
    <>
      <Field label="Power (CC)">
        <Input
          type="number"
          value={form.powerCC}
          onChange={(e) => patch({ powerCC: e.target.value })}
          placeholder="e.g. 349"
        />
      </Field>
      <Field label="Engine type">
        <Input
          value={form.engineType}
          onChange={(e) => patch({ engineType: e.target.value })}
          placeholder="e.g. Air-oil cooled, 4-stroke"
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
          placeholder="e.g. Self / Kick"
        />
      </Field>
      <Field label="Fuel capacity">
        <Input
          value={form.fuelCapacity}
          onChange={(e) => patch({ fuelCapacity: e.target.value })}
          placeholder="e.g. 13 L"
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
          placeholder="e.g. Petrol"
        />
      </Field>
      <Field label="Stroke">
        <Input
          value={form.stroke}
          onChange={(e) => patch({ stroke: e.target.value })}
        />
      </Field>
      <Field label="Reserve fuel">
        <Input
          value={form.reserveFuelCapacity}
          onChange={(e) => patch({ reserveFuelCapacity: e.target.value })}
        />
      </Field>
      <Field label="Mileage (claimed)">
        <Input
          value={form.mileageClaimed}
          onChange={(e) => patch({ mileageClaimed: e.target.value })}
          placeholder="e.g. 41 kmpl"
        />
      </Field>
      <Field label="Mileage (user)">
        <Input
          value={form.mileageUser}
          onChange={(e) => patch({ mileageUser: e.target.value })}
        />
      </Field>
    </>
  );
}

function EngineTab({ form, patch }) {
  const isEV = form.isElectric === 'Y';
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <p className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {isEV
          ? 'Showing electric powertrain fields. Set “Electric?” to No on the Basics tab for engine fields.'
          : 'Showing engine fields. Set “Electric?” to Yes on the Basics tab for battery and motor fields.'}
      </p>
      {isEV ? (
        <ElectricPowertrainFields form={form} patch={patch} />
      ) : (
        <CombustionPowertrainFields form={form} patch={patch} />
      )}
      {/* Shared across both powertrains. */}
      <Field label="Max torque">
        <Input
          value={form.maxTorque}
          onChange={(e) => patch({ maxTorque: e.target.value })}
          placeholder="e.g. 27 Nm @ 4000 rpm"
        />
      </Field>
      <Field label="0–60 / acceleration">
        <Input
          value={form.accelerationTime}
          onChange={(e) => patch({ accelerationTime: e.target.value })}
          placeholder="e.g. 5.4s"
        />
      </Field>
      <Field label="Top speed">
        <Input
          value={form.topSpeed}
          onChange={(e) => patch({ topSpeed: e.target.value })}
          placeholder="e.g. 120 kmph"
        />
      </Field>
      <Field label="Front brake">
        <Input
          value={form.frontBrake}
          onChange={(e) => patch({ frontBrake: e.target.value })}
          placeholder="e.g. 300mm Disc"
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
          placeholder="e.g. ABS dual-channel"
        />
      </Field>
    </div>
  );
}

function BodyTab({ form, patch }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Wheels type">
        <Input
          value={form.wheelsType}
          onChange={(e) => patch({ wheelsType: e.target.value })}
          placeholder="Alloy / Spoke"
        />
      </Field>
      <Field label="Tyre type">
        <Select
          value={form.tyreType}
          onChange={(v) => patch({ tyreType: v })}
          options={[
            { value: '', label: 'Select…' },
            ...TYRE_TYPES.map((t) => ({ value: t, label: t })),
          ]}
        />
      </Field>
      <Field label="Front wheel size">
        <Input
          value={form.frontWheelSize}
          onChange={(e) => patch({ frontWheelSize: e.target.value })}
        />
      </Field>
      <Field label="Rear wheel size">
        <Input
          value={form.rearWheelSize}
          onChange={(e) => patch({ rearWheelSize: e.target.value })}
        />
      </Field>
      <Field label="Weight">
        <Input
          value={form.weight}
          onChange={(e) => patch({ weight: e.target.value })}
          placeholder="e.g. 195 kg"
        />
      </Field>
      <Field label="Seat height">
        <Input
          value={form.seatHeight}
          onChange={(e) => patch({ seatHeight: e.target.value })}
          placeholder="e.g. 805 mm"
        />
      </Field>
      <Field label="Overall height">
        <Input
          value={form.overallHeight}
          onChange={(e) => patch({ overallHeight: e.target.value })}
        />
      </Field>
      <Field label="Chassis type">
        <Input
          value={form.chassisType}
          onChange={(e) => patch({ chassisType: e.target.value })}
        />
      </Field>
      <Field label="Seat type" className="sm:col-span-2">
        <Input
          value={form.seatType}
          onChange={(e) => patch({ seatType: e.target.value })}
          placeholder="Single / Split"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Key type">
          <Input
            value={form.keyType}
            onChange={(e) => patch({ keyType: e.target.value })}
            placeholder="Smart / Mechanical"
          />
        </Field>
        <Field label="Free service count">
          <Input
            type="number"
            value={form.freeServiceCount}
            onChange={(e) => patch({ freeServiceCount: e.target.value })}
          />
        </Field>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Service schedule
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="1st service (km)">
            <Input
              value={form.firstServiceKM}
              onChange={(e) => patch({ firstServiceKM: e.target.value })}
              placeholder="e.g. 500"
            />
          </Field>
          <Field label="1st service (days)">
            <Input
              value={form.firstServiceDays}
              onChange={(e) => patch({ firstServiceDays: e.target.value })}
              placeholder="e.g. 30"
            />
          </Field>
          <Field label="2nd service (km)">
            <Input
              value={form.secondServiceKM}
              onChange={(e) => patch({ secondServiceKM: e.target.value })}
            />
          </Field>
          <Field label="2nd service (days)">
            <Input
              value={form.secondServiceDays}
              onChange={(e) => patch({ secondServiceDays: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Images panel — separate API path. Local `images` list mirrors backend state
// after each mutation so the parent's vehicle.images on the list page stays
// fresh once the modal closes (parent reloads via reloadAll() on save).
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
      // Backend expects @RequestParam("file") List<MultipartFile> — same key for all.
      for (const f of files) fd.append('file', f);
      const resp = await VehiclesApi.addImages(vehicleID, fd);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to upload images.');
      }
      // refetch the canonical list
      const list = await VehiclesApi.getImages(vehicleID);
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
      const resp = await VehiclesApi.removeImage(vehicleID, imageURL);
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
      'Remove ALL images for this vehicle? This can\'t be undone.',
    );
    if (!ok) return;
    setRemovingAll(true);
    onError('');
    try {
      const resp = await VehiclesApi.removeAllImages(vehicleID);
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
          <div className="mt-0.5 text-xs text-slate-400">
            Upload up to 10 at a time.
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
// Pricing panel — list/add/update on-road prices per city.
//
// Backend constraints worth knowing about while reading this:
//   - addOnRoadPrice rejects duplicate (vehicle, city) pairs (ALREADY_EXIST),
//     so we filter the city dropdown to those that don't have a price yet.
//   - updateOnRoadPrice only updates the onRoadPrice field. Insurance / RTO /
//     ex-showroom can't be edited after creation through this endpoint, so
//     the row only exposes inline edit on onRoadPrice.
// -----------------------------------------------------------------------------
// Platform's per-unit dealer commission for this model (what the showroom
// pays us on each sale, typically ₹3-7k). Admin-eyes-only: the backend keeps
// it out of every vehicle payload; it's readable/writable solely through the
// dedicated commission endpoints. Sale recording uses it to auto-compute the
// platform's earning and the sales exec's cut.
function DealerCommissionCard({ vehicleID }) {
  const [value, setValue] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    VehiclesApi.getCommission(vehicleID)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setValue(resp.data.data != null ? String(resp.data.data) : '');
        }
      })
      .catch(() => {
        // Card still renders; saving will surface real errors.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleID]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSavedFlash(false);
    try {
      const amount = value.trim() === '' ? null : value.trim();
      const resp = await VehiclesApi.setCommission(vehicleID, amount);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save commission.');
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to save commission.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
        Dealer commission (admin-only)
      </div>
      <div className="mb-2 text-[11px] text-slate-500">
        What the showroom pays us per unit sold. Never shown in the app or to
        staff — sales record it automatically: platform earns this amount, the
        sales exec gets their percentage of it.
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          placeholder="e.g. 5000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!loaded}
          className="max-w-[180px]"
        />
        <Button
          size="sm"
          variant="secondary"
          loading={saving}
          disabled={saving || !loaded}
          onClick={handleSave}
        >
          Save
        </Button>
        {savedFlash && (
          <span className="text-xs font-semibold text-emerald-600">Saved</span>
        )}
      </div>
      {error && (
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

function PricingPanel({ vehicleID }) {
  const [prices, setPrices] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load prices + cities in parallel
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      VehiclesApi.getOnRoadPrices(vehicleID),
      CitiesApi.getAll(),
    ]).then(([priceRes, cityRes]) => {
      if (cancelled) return;
      if (priceRes.status === 'fulfilled') {
        const r = priceRes.value;
        const status = r?.data?.status;
        if (status === 'SUCCESS') setPrices(r.data.data || []);
        else if (status === 'EMPTY') setPrices([]);
        else
          setError(r?.data?.msg || 'Failed to load on-road prices.');
      } else {
        setError(
          priceRes.reason?.response?.data?.msg ||
            priceRes.reason?.message ||
            'Failed to load on-road prices.',
        );
      }
      if (cityRes.status === 'fulfilled') {
        const r = cityRes.value;
        if (r?.data?.status === 'SUCCESS' || r?.data?.status === 'EMPTY') {
          setCities(r.data.data || []);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicleID, reloadKey]);

  function startEdit(price) {
    setEditingId(price.id);
    setEditValue(price.onRoadPrice ?? '');
    setError('');
  }
  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }
  async function saveEdit(price) {
    if (!editValue.trim()) {
      setError('On-road price cannot be empty.');
      return;
    }
    setSavingId(price.id);
    setError('');
    try {
      const resp = await VehiclesApi.updateOnRoadPrice(price.id, editValue.trim());
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update price.');
      }
      const updated = resp.data.data;
      setPrices((prev) =>
        prev.map((p) =>
          p.id === price.id
            ? { ...p, onRoadPrice: updated?.onRoadPrice ?? editValue.trim() }
            : p,
        ),
      );
      cancelEdit();
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to update price.',
      );
    } finally {
      setSavingId(null);
    }
  }

  // Cities with a price already set — exclude from the add dropdown.
  const pricedCityIDs = useMemo(
    () => new Set(prices.map((p) => p.city?.id).filter((id) => id != null)),
    [prices],
  );
  const availableCities = useMemo(
    () =>
      (cities || [])
        .filter((c) => Number(c.status) === 1)
        .filter((c) => !pricedCityIDs.has(c.id)),
    [cities, pricedCityIDs],
  );

  return (
    <div className="space-y-3">
      <DealerCommissionCard vehicleID={vehicleID} />

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {prices.length} cit{prices.length === 1 ? 'y' : 'ies'} priced
          {availableCities.length > 0 &&
            ` · ${availableCities.length} available to add`}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen((o) => !o)}
          disabled={availableCities.length === 0}
          title={
            availableCities.length === 0
              ? 'All active cities are already priced'
              : 'Add price for a new city'
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add price
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {addOpen && (
        <AddPriceForm
          vehicleID={vehicleID}
          cities={availableCities}
          onCancel={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            setReloadKey((k) => k + 1);
          }}
          onError={setError}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">City</th>
              <th className="px-3 py-2.5">On-road</th>
              <th className="px-3 py-2.5">Ex-showroom</th>
              <th className="px-3 py-2.5">Insurance</th>
              <th className="px-3 py-2.5">RTO</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {[0, 1, 2, 3, 4, 5].map((c) => (
                    <td key={c} className="px-3 py-2.5">
                      <Skeleton className="h-3 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : prices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-xs text-slate-500"
                >
                  No on-road prices set yet for this vehicle.
                </td>
              </tr>
            ) : (
              prices.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-medium text-slate-700">
                    {p.city?.name || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {editingId === p.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                      />
                    ) : (
                      <span className="text-slate-700">
                        {p.onRoadPrice || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {p.exShowRoomPrice || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {p.insurance || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {p.rto || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === p.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={savingId === p.id}
                            disabled={savingId !== null}
                            onClick={() => saveEdit(p)}
                            className="text-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={savingId !== null}
                            onClick={cancelEdit}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => startEdit(p)}
                          disabled={editingId !== null}
                          title="Edit on-road price (insurance/RTO/ex-showroom can't be edited via this endpoint)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddPriceForm({ vehicleID, cities, onCancel, onAdded, onError }) {
  const [cityID, setCityID] = useState('');
  const [onRoadPrice, setOnRoadPrice] = useState('');
  const [exShowRoomPrice, setExShowRoomPrice] = useState('');
  const [insurance, setInsurance] = useState('');
  const [rto, setRto] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!cityID || !onRoadPrice.trim()) {
      onError('City and on-road price are required.');
      return;
    }
    setSubmitting(true);
    onError('');
    try {
      const resp = await VehiclesApi.addOnRoadPrice({
        cityID: Number(cityID),
        vehicleID,
        onRoadPrice: onRoadPrice.trim(),
        insurance: insurance.trim(),
        exShowRoomPrice: exShowRoomPrice.trim(),
        rto: rto.trim(),
      });
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to add price.');
      }
      onAdded();
    } catch (err) {
      onError(
        err?.response?.data?.msg || err?.message || 'Failed to add price.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-brand-100 bg-brand-50/40 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="add-price-city">City</Label>
          <Select
            value={cityID}
            onChange={setCityID}
            options={[
              { value: '', label: 'Select city…' },
              ...cities.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div>
          <Label>On-road price *</Label>
          <Input
            value={onRoadPrice}
            onChange={(e) => setOnRoadPrice(e.target.value)}
            placeholder="e.g. ₹2,40,000"
          />
        </div>
        <div>
          <Label>Ex-showroom</Label>
          <Input
            value={exShowRoomPrice}
            onChange={(e) => setExShowRoomPrice(e.target.value)}
            placeholder="e.g. ₹2,15,000"
          />
        </div>
        <div>
          <Label>Insurance</Label>
          <Input
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            placeholder="e.g. ₹12,000"
          />
        </div>
        <div>
          <Label>RTO</Label>
          <Input
            value={rto}
            onChange={(e) => setRto(e.target.value)}
            placeholder="e.g. ₹13,000"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          loading={submitting}
          disabled={submitting || !cityID || !onRoadPrice.trim()}
        >
          Add price
        </Button>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Videos panel — list/add/delete VLink rows tied to a vehicle.
// -----------------------------------------------------------------------------
function VideosPanel({ vehicleID }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getVideos(vehicleID)
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') setVideos(resp.data.data || []);
        else if (status === 'EMPTY') setVideos([]);
        else
          setError(resp?.data?.msg || 'Failed to load videos.');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load videos.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleID, reloadKey]);

  async function handleDelete(video) {
    const ok = window.confirm(
      `Delete video "${video.title || `#${video.id}`}"? This can't be undone.`,
    );
    if (!ok) return;
    setDeletingId(video.id);
    setError('');
    try {
      const resp = await VehiclesApi.deleteVideo(video.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete video.');
      }
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to delete video.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {videos.length} video{videos.length === 1 ? '' : 's'}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen((o) => !o)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add video
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {addOpen && (
        <AddVideoForm
          vehicleID={vehicleID}
          onCancel={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            setReloadKey((k) => k + 1);
          }}
          onError={setError}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          No videos yet for this vehicle.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {videos.map((v) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">
                  {v.title || `Video #${v.id}`}
                </div>
                {v.description && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {v.description}
                  </div>
                )}
                {v.link && (
                  <a
                    href={v.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="max-w-md truncate">{v.link}</span>
                  </a>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={deletingId === v.id}
                disabled={deletingId !== null}
                onClick={() => handleDelete(v)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Delete video"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddVideoForm({ vehicleID, onCancel, onAdded, onError }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !link.trim()) {
      onError('Title and link are required.');
      return;
    }
    setSubmitting(true);
    onError('');
    try {
      // Backend addvideo expects a flat Map<String,String>:
      //   { vehicleID, title, description, link }
      const resp = await VehiclesApi.addVideo({
        vehicleID: String(vehicleID),
        title: title.trim(),
        description: description.trim(),
        link: link.trim(),
      });
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to add video.');
      }
      onAdded();
    } catch (err) {
      onError(
        err?.response?.data?.msg || err?.message || 'Failed to add video.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-3"
    >
      <div>
        <Label htmlFor="add-video-title">Title *</Label>
        <Input
          id="add-video-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. First ride review"
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="add-video-link">Link *</Label>
        <Input
          id="add-video-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://youtu.be/…"
        />
      </div>
      <div>
        <Label htmlFor="add-video-desc">Description</Label>
        <textarea
          id="add-video-desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description for the video card"
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          loading={submitting}
          disabled={submitting || !title.trim() || !link.trim()}
        >
          Add video
        </Button>
      </div>
    </form>
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
