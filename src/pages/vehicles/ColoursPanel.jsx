import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Palette,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Vehicles as VehiclesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

/**
 * Per-vehicle colour variant manager. Mirrors the layout of ImagesPanel /
 * PricingPanel — one fetch on mount, optimistic-ish updates after each API
 * call, errors surfaced inline.
 *
 * Variant images are managed *inside* each variant card so admins can see at
 * a glance how many paint shots are attached to each colour. The Vehicle-
 * level `Images` tab continues to hold colour-agnostic shots (cockpit,
 * dimensions, etc.) — both buckets are merged in the consumer app's gallery.
 */
export default function ColoursPanel({ vehicleID }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VehiclesApi.colorVariants
      .list(vehicleID)
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') setVariants(resp.data.data || []);
        else if (status === 'EMPTY') setVariants([]);
        else setError(resp?.data?.msg || 'Failed to load colour variants.');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load colour variants.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleID, reloadKey]);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(variant) {
    const ok = window.confirm(
      `Delete colour "${variant.name}"? Its images will also be removed. This can't be undone.`,
    );
    if (!ok) return;
    setError('');
    try {
      const resp = await VehiclesApi.colorVariants.remove(variant.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete colour.');
      }
      setVariants((prev) => prev.filter((v) => v.id !== variant.id));
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to delete colour.',
      );
    }
  }

  function patchVariantInList(id, partial) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...partial } : v)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {variants.length} colour{variants.length === 1 ? '' : 's'} ·
          generic vehicle images still live on the Images tab.
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen((o) => !o)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add colour
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {addOpen && (
        <VariantForm
          mode="create"
          onCancel={() => setAddOpen(false)}
          onSubmit={async (body) => {
            const resp = await VehiclesApi.colorVariants.create(vehicleID, body);
            if (resp?.data?.status !== 'SUCCESS') {
              throw new Error(resp?.data?.msg || 'Failed to create colour.');
            }
            setAddOpen(false);
            refresh();
          }}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : variants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <Palette className="mb-2 h-8 w-8 text-slate-300" />
          <div className="text-sm font-medium text-slate-600">
            No colours yet
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            Add at least one to enable the colour swatch row on the consumer app.
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {variants.map((v) => (
            <VariantCard
              key={v.id}
              variant={v}
              isEditing={editingId === v.id}
              onStartEdit={() => setEditingId(v.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaved={(updated) => {
                patchVariantInList(v.id, updated);
                setEditingId(null);
              }}
              onDelete={() => handleDelete(v)}
              onImagesChanged={(next) => patchVariantInList(v.id, { images: next })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Per-variant card with metadata + image management.
// -----------------------------------------------------------------------------
function VariantCard({
  variant,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onDelete,
  onImagesChanged,
}) {
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 p-3">
        <SwatchPreview hex={variant.hexCode} secondaryHex={variant.secondaryHex} />
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <VariantForm
              mode="edit"
              initial={variant}
              onCancel={onCancelEdit}
              onSubmit={async (body) => {
                const resp = await VehiclesApi.colorVariants.update(variant.id, body);
                if (resp?.data?.status !== 'SUCCESS') {
                  throw new Error(resp?.data?.msg || 'Failed to update colour.');
                }
                onSaved(resp.data.data || body);
              }}
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {variant.name}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                  {variant.hexCode}
                </span>
                {variant.secondaryHex && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    + {variant.secondaryHex}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>order #{variant.sortOrder ?? 0}</span>
                {variant.priceDelta && <span>{variant.priceDelta}</span>}
                <span>
                  {(variant.images || []).length} image
                  {(variant.images || []).length === 1 ? '' : 's'}
                </span>
              </div>
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={onStartEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onDelete}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              title="Delete colour"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <VariantImages
        variantID={variant.id}
        images={variant.images || []}
        onChanged={onImagesChanged}
      />
    </li>
  );
}

function SwatchPreview({ hex, secondaryHex }) {
  const primary = hex || '#000000';
  // Dual-tone preview mirrors the consumer-app diagonal split so admins know
  // exactly what users will see.
  if (secondaryHex) {
    return (
      <div
        className="h-12 w-12 shrink-0 rounded-full border border-slate-200 shadow-soft"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${primary} 50%, ${secondaryHex} 50%, ${secondaryHex} 100%)`,
        }}
      />
    );
  }
  return (
    <div
      className="h-12 w-12 shrink-0 rounded-full border border-slate-200 shadow-soft"
      style={{ backgroundColor: primary }}
    />
  );
}

// -----------------------------------------------------------------------------
// Variant create / edit form
// -----------------------------------------------------------------------------
function VariantForm({ mode, initial, onCancel, onSubmit }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [hex, setHex] = useState(initial?.hexCode ?? '#304FFE');
  const [hasSecondary, setHasSecondary] = useState(!!initial?.secondaryHex);
  const [secondaryHex, setSecondaryHex] = useState(
    initial?.secondaryHex ?? '#D32F2F',
  );
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder != null ? String(initial.sortOrder) : '0',
  );
  const [priceDelta, setPriceDelta] = useState(initial?.priceDelta ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    if (!name.trim()) {
      setLocalError('Name is required.');
      return;
    }
    if (!isValidHex(hex)) {
      setLocalError('Hex must be #RRGGBB or #AARRGGBB.');
      return;
    }
    if (hasSecondary && !isValidHex(secondaryHex)) {
      setLocalError('Secondary hex must be #RRGGBB or #AARRGGBB.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        hexCode: hex.toUpperCase(),
        secondaryHex: hasSecondary ? secondaryHex.toUpperCase() : null,
        sortOrder: Number(sortOrder) || 0,
        priceDelta: priceDelta.trim() || null,
      });
    } catch (err) {
      setLocalError(err?.message || 'Save failed.');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'rounded-xl border bg-white p-3',
        mode === 'create' ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200',
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Name *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Glossy Red"
            autoFocus
          />
        </div>
        <div>
          <Label>Hex *</Label>
          <HexInput value={hex} onChange={setHex} />
        </div>
        <div>
          <Label>Sort order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={hasSecondary}
              onChange={(e) => setHasSecondary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Dual-tone (second colour)
          </label>
        </div>
        {hasSecondary && (
          <div className="sm:col-span-2">
            <Label>Secondary hex</Label>
            <HexInput value={secondaryHex} onChange={setSecondaryHex} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Price delta (optional)</Label>
          <Input
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
            placeholder="e.g. + ₹2,000"
          />
        </div>
      </div>

      {localError && (
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {localError}
        </div>
      )}

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
        <Button type="submit" size="sm" loading={submitting} disabled={submitting}>
          {mode === 'create' ? 'Add colour' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function HexInput({ value, onChange }) {
  // Native color input gives us the picker; the text input lets admins paste
  // an exact hex from spec sheets. They share state so editing either reflects
  // in the other.
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={isValidHex(value) ? toShortHex(value) : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-10 w-12 cursor-pointer rounded-md border border-slate-200 bg-white"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#RRGGBB"
        className="font-mono text-sm"
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Per-variant image management — separate API endpoints, kept inside the card
// so admins can see image counts + manage paint shots in context.
// -----------------------------------------------------------------------------
function VariantImages({ variantID, images, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [removingURL, setRemovingURL] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (files.length > 10) {
      setError('Upload up to 10 images at a time.');
      return;
    }
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        setError(`"${f.name}" isn't an image.`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setError(`"${f.name}" exceeds 5 MB.`);
        return;
      }
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      for (const f of files) fd.append('file', f);
      const resp = await VehiclesApi.colorVariants.addImages(variantID, fd);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to upload images.');
      }
      onChanged(resp.data.data?.images || []);
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to upload images.',
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove(url) {
    const ok = window.confirm('Remove this image?');
    if (!ok) return;
    setRemovingURL(url);
    setError('');
    try {
      const resp = await VehiclesApi.colorVariants.removeImage(variantID, url);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to remove image.');
      }
      onChanged(resp.data.data?.images || images.filter((u) => u !== url));
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to remove image.',
      );
    } finally {
      setRemovingURL(null);
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Paint shots
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          loading={uploading}
          disabled={uploading}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
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
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
          <ImageIcon className="h-4 w-4 text-slate-300" />
          No paint shots for this colour yet.
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {images.map((url) => (
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
                onClick={() => handleRemove(url)}
                disabled={removingURL === url}
                className={cn(
                  'absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow-soft transition',
                  'hover:bg-red-50',
                  removingURL === url && 'animate-pulse',
                )}
                title="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function isValidHex(h) {
  if (!h) return false;
  const s = h.startsWith('#') ? h.slice(1) : h;
  return /^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(s);
}

/// Native <input type="color"> only accepts #RRGGBB; if the stored value is
/// #AARRGGBB strip the alpha for the picker (still kept in state).
function toShortHex(h) {
  const s = h.startsWith('#') ? h.slice(1) : h;
  if (s.length === 8) return '#' + s.slice(2);
  return '#' + s;
}
