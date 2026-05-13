import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Landmark,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Finance as FinanceApi } from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

// Backend hardcodes 1=active, 99=disabled, 0=deleted in countByStatus.
const STATUS_ACTIVE = 1;
const STATUS_DISABLED = 99;
const MAX_NAME_LENGTH = 50;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'modified', label: 'Updated' },
  { value: 'created', label: 'Newest' },
];
const NO_IMAGE_SUFFIX = '/other/not-found.png';

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

function hasRealLogo(url) {
  return Boolean(url) && !url.endsWith(NO_IMAGE_SUFFIX);
}

export default function FinanceList() {
  const [items, setItems] = useState([]);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [mutatingId, setMutatingId] = useState(null);
  const [logoItem, setLogoItem] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Reset to page 0 whenever the debounced search query changes.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    FinanceApi.getAll({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      q: debouncedQuery.trim() || undefined,
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
          setItems(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else if (status === 'EMPTY') {
          setItems([]);
          setMeta({
            pageNumber: page,
            totalPages: 0,
            totalElements: 0,
            lastPage: true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load financiers.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load financiers.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    FinanceApi.countSummary()
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

  async function handleToggle(item) {
    const goingToActive = item.status !== STATUS_ACTIVE;
    setMutatingId(item.id);
    setError('');
    try {
      const resp = goingToActive
        ? await FinanceApi.enable(item.id)
        : await FinanceApi.disable(item.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update financier.');
      }
      const updated = resp.data.data;
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status:
                  updated?.status ??
                  (goingToActive ? STATUS_ACTIVE : STATUS_DISABLED),
                modified: updated?.modified ?? it.modified,
              }
            : it,
        ),
      );
      reloadAll();
    } catch (err) {
      setError(
        err?.response?.data?.msg ||
          err?.message ||
          'Failed to update financier.',
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
        title="Finance"
        subtitle="Loan partners surfaced inside the buyer journey."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add financier
          </Button>
        }
      />

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CountChip label="Total" value={counts.totalFinance} />
          <CountChip label="Active" value={counts.activeFinance} tone="emerald" />
          <CountChip
            label="Disabled"
            value={counts.disabledFinance}
            tone="amber"
          />
          <CountChip label="Deleted" value={counts.deletedFinance} tone="slate" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search financier name…"
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Financier</th>
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
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
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <EmptyState
                      icon={Landmark}
                      title={
                        debouncedQuery.trim()
                          ? 'No financiers match your search'
                          : 'No financiers yet'
                      }
                      description={
                        debouncedQuery.trim()
                          ? 'Try a different search term, or clear the search.'
                          : 'Add the first finance partner to surface it on the buyer journey.'
                      }
                      action={
                        !debouncedQuery.trim() ? (
                          <Button onClick={() => setAddOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add financier
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <FinanceLogoThumb item={item} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(item.modified)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setLogoItem(item)}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {hasRealLogo(item.imageURL) ? 'Replace' : 'Upload'}
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            item.status === STATUS_ACTIVE ? 'ghost' : 'secondary'
                          }
                          loading={mutatingId === item.id}
                          disabled={mutatingId !== null}
                          onClick={() => handleToggle(item)}
                        >
                          {item.status === STATUS_ACTIVE ? 'Disable' : 'Enable'}
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
                ? debouncedQuery.trim()
                  ? 'No matches.'
                  : 'No financiers.'
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

      <AddFinanceModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingNames={items.map((it) => it.name.toLowerCase())}
        onAdded={() => {
          setAddOpen(false);
          reloadAll();
        }}
      />

      <LogoModal
        item={logoItem}
        onClose={() => setLogoItem(null)}
        onSaved={(updated) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === updated.id
                ? {
                    ...it,
                    imageURL: updated.imageURL,
                    modified: updated.modified ?? it.modified,
                  }
                : it,
            ),
          );
        }}
      />
    </div>
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

function FinanceLogoThumb({ item }) {
  if (!hasRealLogo(item.imageURL)) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={item.imageURL}
      alt={`${item.name} logo`}
      className="h-9 w-9 rounded-md border border-slate-200 bg-white object-contain p-0.5"
      loading="lazy"
    />
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

function CountChip({ label, value, tone = 'brand' }) {
  const toneClasses = {
    brand: 'border-brand-100 bg-brand-50 text-brand-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
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

function AddFinanceModal({ open, onClose, existingNames, onAdded }) {
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
      return 'A financier with this name already exists.';
    return '';
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trimmed || localError) return;
    setSubmitting(true);
    setServerError('');
    try {
      const resp = await FinanceApi.add(trimmed);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to add financier.');
      }
      onAdded();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to add financier.',
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title="Add financier"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-finance-form"
            loading={submitting}
            disabled={submitting || !trimmed || Boolean(localError)}
          >
            Add financier
          </Button>
        </>
      }
    >
      <form id="add-finance-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="finance-name">Financier name</Label>
          <Input
            id="finance-name"
            autoFocus
            placeholder="e.g. Bajaj Finance"
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
        <p className="text-[11px] text-slate-500">
          The logo can be uploaded after the financier is created.
        </p>
        {(localError || serverError) && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError || localError}
          </div>
        )}
      </form>
    </Modal>
  );
}

function LogoModal({ item, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [previewURL, setPreviewURL] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [localError, setLocalError] = useState('');
  const fileInputRef = useRef(null);

  const open = item !== null;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreviewURL('');
    setSubmitting(false);
    setServerError('');
    setLocalError('');
  }, [open, item?.id]);

  useEffect(() => {
    if (!file) {
      setPreviewURL('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handlePick(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setLocalError('Only image files are allowed.');
      setFile(null);
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setLocalError('File size must be 3 MB or less.');
      setFile(null);
      return;
    }
    if (picked.name.includes('..')) {
      setLocalError('Filename cannot contain "..".');
      setFile(null);
      return;
    }
    setLocalError('');
    setFile(picked);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !item) return;
    setSubmitting(true);
    setServerError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const resp = await FinanceApi.addImage(item.id, fd);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to upload logo.');
      }
      const updated = resp.data.data;
      onSaved({
        id: item.id,
        imageURL: updated?.imageURL ?? item.imageURL,
        modified: updated?.modified,
      });
      onClose();
    } catch (err) {
      setServerError(
        err?.response?.data?.msg || err?.message || 'Failed to upload logo.',
      );
      setSubmitting(false);
    }
  }

  if (!open) return null;
  const currentLogoVisible = hasRealLogo(item.imageURL) && !previewURL;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title={`Financier logo — ${item.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="finance-logo-form"
            loading={submitting}
            disabled={submitting || !file}
          >
            Upload
          </Button>
        </>
      }
    >
      <form id="finance-logo-form" onSubmit={handleUpload} className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {previewURL ? (
              <img
                src={previewURL}
                alt="Preview"
                className="h-full w-full object-contain"
              />
            ) : currentLogoVisible ? (
              <img
                src={item.imageURL}
                alt={`${item.name} logo`}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-300" />
            )}
          </div>
          <div className="flex-1 text-xs text-slate-500">
            <div className="mb-2">PNG, JPG, or WebP. Max 3 MB.</div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <Upload className="h-3.5 w-3.5" />
              {file ? 'Choose different file' : 'Choose file'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePick}
            />
            {file && (
              <div className="mt-2 truncate text-[11px] text-slate-500">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </div>
            )}
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
