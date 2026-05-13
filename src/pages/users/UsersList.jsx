import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Search,
  Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Users as UsersApi } from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

// Backend supports server-side pagination, sort, and a `q` search across
// name/email/phone (UserRepository.searchUsers). The search input is
// debounced and sent as the `q` param.
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'created', label: 'Joined date' },
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

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({
    pageNumber: 0,
    totalPages: 0,
    totalElements: 0,
    lastPage: true,
  });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('created');
  const [sortDir, setSortDir] = useState('desc');
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reset to page 0 whenever the debounced search query changes.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    UsersApi.getAll({
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
          // Backend Lombok builder declares the field as `LastPage` —
          // accept either casing and fall back to deriving it from totalPages
          // so a JSON-naming mismatch doesn't lock the Next button.
          const lastPage =
            payload?.lastPage ??
            payload?.LastPage ??
            pageNumber >= Math.max(0, totalPages - 1);
          setUsers(payload?.content || []);
          setMeta({
            pageNumber,
            totalPages,
            totalElements: payload?.totalElements ?? 0,
            lastPage,
          });
          setError('');
        } else if (status === 'EMPTY') {
          setUsers([]);
          setMeta({
            pageNumber: page,
            totalPages: 0,
            totalElements: 0,
            lastPage: true,
          });
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load users.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load users.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sortBy, sortDir, debouncedQuery]);

  const showingFrom =
    meta.totalElements === 0 ? 0 : meta.pageNumber * pageSize + 1;
  const showingTo =
    meta.totalElements === 0
      ? 0
      : Math.min(meta.totalElements, (meta.pageNumber + 1) * pageSize);

  function handleChangePageSize(next) {
    setPageSize(next);
    setPage(0);
  }

  function handleChangeSort(next) {
    setSortBy(next);
    setPage(0);
  }

  function toggleSortDir() {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Consumers signed in to the wheely app."
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
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
              onChange={handleChangeSort}
              options={SORT_OPTIONS}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleSortDir}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
            </Button>
            <ToolbarSelect
              label="Per page"
              value={pageSize}
              onChange={handleChangePageSize}
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Auth</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4, 5].map((c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className="h-3 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <EmptyState
                      icon={UsersIcon}
                      title={
                        debouncedQuery.trim()
                          ? 'No users match your search'
                          : 'No users yet'
                      }
                      description={
                        debouncedQuery.trim()
                          ? 'Try a different search term, or clear the search.'
                          : 'No users have signed up yet.'
                      }
                      className="border-0 bg-transparent py-0"
                    />
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      {u.name || '—'}
                      {u.age > 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                          {u.age}y
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      <div className="space-y-1">
                        {u.email && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate">{u.email}</span>
                          </div>
                        )}
                        {u.phone && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                        {!u.email && !u.phone && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3.5">
                      <UserStatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {u.authProvider || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(u.created)}
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
                  : 'No users.'
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
          // preserve numeric values
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

function RoleBadge({ role }) {
  const r = (role || '').toUpperCase();
  const tone =
    r === 'ADMIN'
      ? 'bg-brand-50 text-brand-700'
      : r === 'PRT'
        ? 'bg-violet-50 text-violet-700'
        : r === 'USER'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-slate-50 text-slate-500';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone,
      )}
    >
      {r || '—'}
    </span>
  );
}

function UserStatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const map = {
    ACTIVE: { tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    BANNED: { tone: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
    CLOSED: { tone: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
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
      {s || '—'}
    </span>
  );
}
