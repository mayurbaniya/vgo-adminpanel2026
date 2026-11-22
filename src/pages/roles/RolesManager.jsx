import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Roles as RolesApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

// Mirrors com.wheely.entities.enums.AdminModule exactly — grouped the same
// way as AdminLayout's sidebar nav so the matrix reads like the sidebar.
const MODULE_GROUPS = [
  {
    label: 'Overview',
    modules: [['DASHBOARD', 'Dashboard']],
  },
  {
    label: 'Catalog',
    modules: [
      ['VEHICLES', 'Vehicles'],
      ['PRICE_REVIEW', 'Price Review'],
      ['USED_VEHICLES', 'Used Vehicles'],
      ['FEATURED_VEHICLES', 'Featured'],
      ['VIDEOS', 'Videos'],
      ['BRANDS', 'Brands'],
      ['CITIES', 'Cities'],
    ],
  },
  {
    label: 'Leads & Sales',
    modules: [
      ['LEADS', 'Leads'],
      ['EXTERNAL_LEADS', 'External Leads'],
      ['SALES', 'Sales'],
      ['LOANS', 'Loan Leads'],
      ['INTEREST_NUDGES', 'Interest Nudges'],
      ['FINANCE', 'Finance'],
    ],
  },
  {
    label: 'Network',
    modules: [
      ['DEALERSHIPS', 'Dealerships'],
      ['STAFF', 'Staff'],
      ['ROLES', 'Roles & Permissions'],
    ],
  },
  {
    label: 'People',
    modules: [
      ['USERS', 'Users'],
      ['PARTNERS', 'Partners'],
      ['REVIEWS', 'Reviews'],
    ],
  },
  {
    label: 'Comms',
    modules: [
      ['HOME_BANNERS', 'Home Banners'],
      ['OFFERS', 'Offers'],
      ['NOTIFICATIONS', 'Notifications'],
    ],
  },
  {
    label: 'Settings',
    modules: [
      ['FEATURE_FLAGS', 'Feature Flags'],
      ['CONTACT_INFO', 'Contact Us'],
      ['SERVER_HEALTH', 'Server Health'],
      ['SESSIONS', 'Sessions'],
      ['AUDIT_LOG', 'Audit Log'],
    ],
  },
];
const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules.map(([key]) => key));

// Mirrors com.wheely.entities.enums.ScopeType — which slice of data (not
// which admin pages) a role's accounts see: a whole city, one dealership,
// or everything.
const SCOPE_TYPES = [
  { value: 'GLOBAL', label: 'Everywhere (Super Admin-level)' },
  { value: 'CITY', label: 'One city' },
  { value: 'DEALERSHIP', label: 'One dealership' },
];

export default function RolesManager() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    try {
      const resp = await RolesApi.getAll();
      if (resp?.data?.status === 'SUCCESS') {
        setRoles(resp.data.data || []);
        setError('');
      } else {
        throw new Error(resp?.data?.msg || 'Failed to load roles.');
      }
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(role) {
    if (!window.confirm(`Delete the "${role.name}" role? Staff must be reassigned first if any are still on it.`)) return;
    setDeletingId(role.id);
    setError('');
    try {
      const resp = await RolesApi.delete(role.id);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to delete role.');
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to delete role.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Every admin page depends on a permission grant here — view/edit are one grant, delete is always separate."
        actions={
          <Button
            onClick={() => {
              setEditingRole(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New role
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No roles yet"
            description="Create a role and grant it view/edit/delete access per module."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{role.name}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{role.description || 'No description'}</div>
                </div>
                {role.bypassAll ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    Full access
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {SCOPE_TYPES.find((s) => s.value === role.scopeType)?.label || role.scopeType}
                  </span>
                )}
              </div>

              <div className="mt-3 text-xs text-slate-500">
                {role.userCount} account{role.userCount === 1 ? '' : 's'} on this role
                {role.isSystem && <span className="ml-1.5 text-slate-400">· built-in</span>}
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setEditingRole(role);
                    setEditorOpen(true);
                  }}
                >
                  {role.isSystem && role.bypassAll ? 'View' : 'Edit permissions'}
                </Button>
                {!role.isSystem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deletingId === role.id}
                    disabled={deletingId !== null}
                    onClick={() => handleDelete(role)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <RoleEditorModal
        open={editorOpen}
        role={editingRole}
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

function emptyMatrix() {
  const m = {};
  for (const module of ALL_MODULES) m[module] = { canView: false, canEdit: false, canDelete: false };
  return m;
}

function RoleEditorModal({ open, role, onClose, onSaved }) {
  const isEdit = Boolean(role);
  const readOnly = Boolean(role?.isSystem && role?.bypassAll); // seeded Super Admin — backend rejects edits to it anyway
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scopeType, setScopeType] = useState('DEALERSHIP');
  const [matrix, setMatrix] = useState(emptyMatrix);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(role?.name || '');
    setDescription(role?.description || '');
    setScopeType(role?.scopeType || 'DEALERSHIP');
    const next = emptyMatrix();
    (role?.permissions || []).forEach((row) => {
      next[row.module] = { canView: row.canView, canEdit: row.canEdit, canDelete: row.canDelete };
    });
    setMatrix(next);
    setServerError('');
    setSubmitting(false);
  }, [open, role]);

  const canSubmit = name.trim().length > 0 && !readOnly;

  function toggle(module, field) {
    setMatrix((prev) => {
      const row = { ...prev[module], [field]: !prev[module][field] };
      // edit/delete each imply view — a role that can edit or delete a
      // module can, at minimum, see it.
      if (field === 'canEdit' && row.canEdit) row.canView = true;
      if (field === 'canDelete' && row.canDelete) row.canView = true;
      if (field === 'canView' && !row.canView) {
        row.canEdit = false;
        row.canDelete = false;
      }
      return { ...prev, [module]: row };
    });
  }

  const permissionsPayload = useMemo(
    () => ALL_MODULES.map((module) => ({ module, ...matrix[module] })),
    [matrix],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError('');
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        bypassAll: false,
        scopeType,
        permissions: permissionsPayload,
      };
      const resp = isEdit ? await RolesApi.update(role.id, body) : await RolesApi.create(body);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save role.');
      }
      await onSaved();
    } catch (err) {
      setServerError(err?.response?.data?.msg || err?.message || 'Failed to save role.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      size="xl"
      title={isEdit ? `Edit ${role?.name}` : 'New role'}
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="role-form" loading={submitting} disabled={submitting || !canSubmit}>
              {isEdit ? 'Save changes' : 'Create role'}
            </Button>
          </>
        )
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" autoFocus value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="role-desc">Description</Label>
            <Input id="role-desc" value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {!readOnly && (
          <div>
            <Label htmlFor="role-scope">Data scope</Label>
            <select
              id="role-scope"
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {SCOPE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Which leads, sales and dealerships an account on this role can see — separate from the module
              permissions below.
            </p>
          </div>
        )}

        {readOnly ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
            This role has full access to every module and can't be edited — that's what "full access" means.
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2 text-center">View</th>
                  <th className="px-3 py-2 text-center">Edit</th>
                  <th className="px-3 py-2 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MODULE_GROUPS.map((group) => (
                  <FragmentGroup key={group.label} group={group} matrix={matrix} toggle={toggle} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {serverError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}

function FragmentGroup({ group, matrix, toggle }) {
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={4} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {group.label}
        </td>
      </tr>
      {group.modules.map(([module, label]) => (
        <tr key={module} className="hover:bg-slate-50/50">
          <td className="px-3 py-2 text-slate-700">{label}</td>
          {['canView', 'canEdit', 'canDelete'].map((field) => (
            <td key={field} className="px-3 py-2 text-center">
              <input
                type="checkbox"
                className={cn(
                  'h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30',
                )}
                checked={matrix[module]?.[field] || false}
                onChange={() => toggle(module, field)}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
