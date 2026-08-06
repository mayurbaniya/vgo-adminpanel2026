import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Plus,
  Search,
  Trash2,
  Video as VideoIcon,
} from 'lucide-react';
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

// video.active / video.disable from backend application.properties
const STATUS_ACTIVE = 1;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];

export default function VideosManager() {
  const [videos, setVideos] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
    activeElements: 0,
    inactiveElements: 0,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('desc');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutatingId, setMutatingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editorVideo, setEditorVideo] = useState(null); // {} for create, {id, ...} for edit

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getAllVideos({
      page,
      size: pageSize,
      sortBy,
      sortDir,
      q: debouncedQuery.trim() || undefined,
      status: status || undefined,
    })
      .then((resp) => {
        if (cancelled) return;
        const respStatus = resp?.data?.status;
        // EMPTY still carries pagination metadata (active/hidden totals).
        if (respStatus === 'SUCCESS' || respStatus === 'EMPTY') {
          const payload = resp.data.data;
          setVideos(payload?.content || []);
          setMeta({
            pageNumber: payload?.pageNumber ?? page,
            totalPages: payload?.totalPages ?? 0,
            totalElements: payload?.totalElements ?? 0,
            lastPage: payload?.lastPage ?? true,
            activeElements: payload?.activeElements ?? 0,
            inactiveElements: payload?.inactiveElements ?? 0,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load videos.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.msg || err?.message || 'Failed to load videos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery, status, reloadKey]);

  const reloadAll = () => setReloadKey((k) => k + 1);

  async function handleToggle(video) {
    const goingVisible = video.active !== STATUS_ACTIVE;
    setMutatingId(video.id);
    setError('');
    try {
      const resp = await VehiclesApi.setVideoVisibility(video.id, goingVisible);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to update video.');
      }
      reloadAll();
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to update video.');
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDelete(video) {
    if (
      !window.confirm(
        `Delete video "${video.title || `#${video.id}`}"? This can't be undone — use Hide to take it off the app without losing it.`,
      )
    )
      return;
    setMutatingId(video.id);
    setError('');
    try {
      const resp = await VehiclesApi.deleteVideo(video.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete video.');
      }
      reloadAll();
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to delete video.');
    } finally {
      setMutatingId(null);
    }
  }

  const showingFrom = meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0 ? 0 : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Videos"
        subtitle="Every video posted across the catalog, with the vehicle it belongs to. Hidden videos stay here but disappear from the mobile app."
        actions={
          <Button onClick={() => setEditorVideo({})}>
            <Plus className="h-4 w-4" />
            New video
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountChip label="Total on page" value={videos.length} />
        <CountChip label="Visible" value={meta.activeElements} tone="emerald" />
        <CountChip label="Hidden" value={meta.inactiveElements} tone="amber" />
        <CountChip label="All-time" value={meta.totalElements} tone="slate" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Input
              leftIcon={<Search className="h-4 w-4" />}
              placeholder="Search title, model, or brand…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="max-w-xs"
            />
            <ToolbarSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </div>
          <div className="flex items-center gap-2">
            <ToolbarSelect
              label="Sort"
              value={`${sortBy}:${sortDir}`}
              onChange={(v) => {
                const [s, d] = String(v).split(':');
                setSortBy(s);
                setSortDir(d);
              }}
              options={[
                { value: 'id:desc', label: 'Newest' },
                { value: 'id:asc', label: 'Oldest' },
                { value: 'title:asc', label: 'Title A–Z' },
              ]}
            />
            <ToolbarSelect
              label="Rows"
              value={pageSize}
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
              options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Video</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12">
                    <EmptyState
                      icon={VideoIcon}
                      title={
                        debouncedQuery.trim() || status
                          ? 'No videos match your filters'
                          : 'No videos yet'
                      }
                      description={
                        debouncedQuery.trim() || status
                          ? 'Try clearing the search or status filter.'
                          : 'Post the first video to start showing content on vehicle pages in the app.'
                      }
                      action={
                        !debouncedQuery.trim() && !status ? (
                          <Button onClick={() => setEditorVideo({})}>
                            <Plus className="h-4 w-4" />
                            New video
                          </Button>
                        ) : null
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                videos.map((video) => (
                  <tr key={video.id} className="transition hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <VideoThumb video={video} />
                        <div className="min-w-0 max-w-[260px]">
                          <div className="truncate font-medium text-slate-900">
                            {video.title || <span className="text-slate-400">Untitled</span>}
                          </div>
                          {video.description && (
                            <div className="truncate text-xs text-slate-500">
                              {video.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">
                        {video.brandName
                          ? `${video.brandName} · ${video.vehicleModel || '—'}`
                          : video.vehicleModel || '—'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Vehicle #{video.vehicleID ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {video.link ? (
                        <a
                          href={video.link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex max-w-[200px] items-center gap-1 text-xs text-brand-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{video.link}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">No link</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={video.active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => setEditorVideo(video)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={video.active === STATUS_ACTIVE ? 'ghost' : 'secondary'}
                          loading={mutatingId === video.id}
                          disabled={mutatingId !== null}
                          onClick={() => handleToggle(video)}
                        >
                          {video.active === STATUS_ACTIVE ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              Show
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={mutatingId !== null}
                          onClick={() => handleDelete(video)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
                ? 'No videos.'
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

      {editorVideo && (
        <VideoEditorModal
          video={editorVideo.id ? editorVideo : null}
          onClose={() => setEditorVideo(null)}
          onSaved={() => {
            setEditorVideo(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Editor modal — create (with vehicle picker) + edit (vehicle is fixed)
// =============================================================================
function VideoEditorModal({ video, onClose, onSaved }) {
  const isEdit = Boolean(video);
  const [form, setForm] = useState({
    vehicleID: '',
    title: '',
    description: '',
    link: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (video) {
      setForm({
        vehicleID: video.vehicleID ?? '',
        title: video.title || '',
        description: video.description || '',
        link: video.link || '',
      });
    } else {
      setForm({ vehicleID: '', title: '', description: '', link: '' });
    }
    setServerError('');
    setSubmitting(false);
  }, [video]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEdit && !form.vehicleID) {
      setServerError('Please pick the vehicle this video belongs to.');
      return;
    }
    if (!form.title.trim()) {
      setServerError('Title is required.');
      return;
    }
    if (!form.link.trim()) {
      setServerError('Video link is required.');
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const resp = isEdit
        ? await VehiclesApi.updateVideo(video.id, {
            title: form.title.trim(),
            description: form.description.trim(),
            link: form.link.trim(),
          })
        : // Backend addvideo expects a flat Map<String,String>.
          await VehiclesApi.addVideo({
            vehicleID: String(form.vehicleID),
            title: form.title.trim(),
            description: form.description.trim(),
            link: form.link.trim(),
          });
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save video.');
      }
      onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to save video.');
      setSubmitting(false);
    }
  }

  const thumb = youtubeThumb(form.link);

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title={isEdit ? `Edit video #${video.id}` : 'New video'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="video-editor-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Add video'}
          </Button>
        </>
      }
    >
      <form id="video-editor-form" onSubmit={handleSubmit} className="space-y-4">
        {isEdit ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Posted on{' '}
            <span className="font-semibold text-slate-800">
              {video.brandName
                ? `${video.brandName} · ${video.vehicleModel || '—'}`
                : video.vehicleModel || `Vehicle #${video.vehicleID}`}
            </span>{' '}
            — to move it to another vehicle, delete and re-add.
          </div>
        ) : (
          <div>
            <Label>Vehicle</Label>
            <VehiclePicker
              selectedId={form.vehicleID}
              onChange={(id) => update({ vehicleID: id })}
            />
          </div>
        )}

        <div>
          <Label htmlFor="video-title">Title *</Label>
          <Input
            id="video-title"
            autoFocus={!isEdit}
            maxLength={120}
            placeholder="First ride review"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="video-link">Link *</Label>
          <Input
            id="video-link"
            leftIcon={<LinkIcon className="h-4 w-4" />}
            placeholder="https://www.youtube.com/watch?v=…"
            value={form.link}
            onChange={(e) => update({ link: e.target.value })}
          />
          {thumb && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={thumb}
                alt="Video preview"
                className="h-14 w-24 rounded-md border border-slate-200 object-cover"
              />
              <div className="text-[11px] text-slate-500">YouTube preview detected.</div>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="video-desc">Description</Label>
          <Input
            id="video-desc"
            maxLength={250}
            placeholder="Short description for the video card"
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
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

// -----------------------------------------------------------------------------
// VehiclePicker — debounced search-as-you-type against /admin/vehicle/all,
// same pattern as the banner CTA picker.
// -----------------------------------------------------------------------------
function VehiclePicker({ selectedId, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolvedLabel, setResolvedLabel] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    VehiclesApi.getAll({
      page: 0,
      size: 10,
      sortBy: 'model',
      sortDir: 'asc',
      q: debouncedQuery.trim() || undefined,
    })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          setResults(resp.data.data?.content || []);
        } else {
          setResults([]);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  function pick(v) {
    onChange(v.id);
    setResolvedLabel(formatVehicleLabel(v));
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative">
      <Input
        leftIcon={<Search className="h-4 w-4" />}
        placeholder={
          selectedId && resolvedLabel ? resolvedLabel : 'Type to search vehicles…'
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {selectedId && !query && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Selected:{' '}
            <span className="font-semibold text-slate-700">
              {resolvedLabel || `Vehicle #${selectedId}`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setResolvedLabel('');
              setQuery('');
            }}
            className="text-red-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}
      {open && (query.trim() || results.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-3 py-3 text-xs text-slate-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">
              No matches{query.trim() ? ` for "${query.trim()}"` : ''}.
            </div>
          ) : (
            results.map((v) => (
              <button
                type="button"
                key={v.id}
                onMouseDown={(e) => {
                  // Prevent input blur before click registers.
                  e.preventDefault();
                  pick(v);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{formatVehicleLabel(v)}</div>
                {v.priceRange && (
                  <div className="text-[11px] text-slate-500">{v.priceRange}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatVehicleLabel(v) {
  if (!v) return '';
  const brand = v.brand?.name || '';
  const model = v.model || `Vehicle #${v.id}`;
  return brand ? `${brand} · ${model}` : model;
}

// =============================================================================
// Bits
// =============================================================================
function VideoThumb({ video }) {
  const thumb = youtubeThumb(video.link) || video.vehicleImage;
  if (!thumb) {
    return (
      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <VideoIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={thumb}
      alt={video.title || `Video #${video.id}`}
      className="h-12 w-20 shrink-0 rounded-md border border-slate-200 bg-white object-cover"
      loading="lazy"
    />
  );
}

function StatusBadge({ active }) {
  const isActive = active === STATUS_ACTIVE;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-amber-500')}
      />
      {isActive ? 'Visible' : 'Hidden'}
    </span>
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
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className={cn('rounded-xl px-3 py-2.5', tones[tone] || tones.brand)}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-lg font-bold">{value ?? '—'}</div>
    </div>
  );
}

// Extract a YouTube video id from watch/short/embed/youtu.be URLs → thumbnail.
function youtubeThumb(link) {
  if (!link) return null;
  const m = String(link).match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}
