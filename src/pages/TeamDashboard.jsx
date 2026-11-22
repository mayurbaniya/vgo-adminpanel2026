import { useEffect, useState } from 'react';
import { Building2, Target, Trophy, Users } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Dashboard as DashboardApi, SalesTargets as SalesTargetsApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext.jsx';
import { formatCount, formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';

/** The CITY/DEALERSHIP-scoped dashboard — employees, dealerships, sales and
 *  targets under the signed-in account's own scope. See GlobalOverview for
 *  the Super Admin (GLOBAL) view. */
export default function TeamDashboard() {
  const { user, isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetModalDealership, setTargetModalDealership] = useState(null);

  const canSetTargets = isSuperAdmin || user?.scopeType === 'CITY';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const resp = await DashboardApi.teamStats();
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to load dashboard.');
      }
      setData(resp.data.data);
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isDealership = data?.scope === 'DEALERSHIP';
  const subtitle = isDealership
    ? data?.dealership?.name
      ? `${data.dealership.name} — your dealership's team and performance.`
      : "Your dealership's team and performance."
    : data?.city?.name
      ? `${data.city.name} — dealerships, staff and performance under you.`
      : 'Dealerships, staff and performance under you.';

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={subtitle} />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatTile
              icon={Users}
              label="Employees"
              value={formatCount(data?.employeeCount)}
            />
            {!isDealership && (
              <StatTile
                icon={Building2}
                label="Dealerships"
                value={formatCount(data?.dealershipCount)}
              />
            )}
            <StatTile
              icon={Trophy}
              label="Sales this month"
              value={formatINR(data?.salesThisMonth)}
              subtitle={`vs ${formatINR(data?.salesLastMonth)} last month`}
            />
            <TargetTile
              target={isDealership ? data?.target : null}
              summary={!isDealership ? data?.targetsSummary : null}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top closers — this month</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? <Skeleton className="h-40 w-full" /> : <LeaderboardList rows={data?.leaderboard || []} />}
          </CardBody>
        </Card>

        {isDealership ? (
          <Card>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? <Skeleton className="h-40 w-full" /> : <EmployeeList employees={data?.employees || []} />}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Dealerships</CardTitle>
            </CardHeader>
            <CardBody>
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <DealershipsTable
                  rows={data?.dealerships || []}
                  canSetTargets={canSetTargets}
                  onSetTarget={(d) => setTargetModalDealership(d)}
                />
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <SetTargetModal
        dealership={targetModalDealership}
        onClose={() => setTargetModalDealership(null)}
        onSaved={async () => {
          setTargetModalDealership(null);
          await load();
        }}
      />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, subtitle }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
            <div className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
            {subtitle && <div className="mt-1 text-[11px] font-medium text-slate-400">{subtitle}</div>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function StatSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </CardBody>
    </Card>
  );
}

function TargetTile({ target, summary }) {
  const targetAmount = target ? Number(target.targetAmount) : Number(summary?.totalTarget);
  const achievedAmount = target ? Number(target.achievedAmount) : Number(summary?.totalAchieved);
  const hasTarget = target ? true : Boolean(summary && Number(summary.totalTarget) > 0);
  const pct = hasTarget && targetAmount > 0 ? Math.min(100, (achievedAmount / targetAmount) * 100) : 0;

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div className="w-full">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">This month's target</div>
            {hasTarget ? (
              <>
                <div className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">
                  {formatINR(achievedAmount)}
                  <span className="ml-1 text-sm font-medium text-slate-400">/ {formatINR(targetAmount)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className={cn('h-2 rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-brand-500')}
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-1.5 text-sm font-medium text-slate-400">No target set yet</div>
            )}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Target className="h-5 w-5" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function LeaderboardList({ rows }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="No deals this month"
        description="Closers appear here as sales are recorded."
        className="border-0 bg-transparent py-6"
      />
    );
  }
  return (
    <ol className="divide-y divide-slate-100">
      {rows.slice(0, 5).map((r, i) => (
        <li key={r.name} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <div
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
              i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            {i + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{r.name}</div>
            <div className="text-[11px] text-slate-500">
              {formatCount(r.deals)} deal{Number(r.deals) === 1 ? '' : 's'}
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-900">{formatINR(r.payout)}</div>
        </li>
      ))}
    </ol>
  );
}

function EmployeeList({ employees }) {
  if (!employees.length) {
    return (
      <EmptyState
        icon={Users}
        title="No employees yet"
        description="Staff assigned to this dealership will show up here."
        className="border-0 bg-transparent py-6"
      />
    );
  }
  return (
    <ol className="divide-y divide-slate-100">
      {employees.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
          <div>
            <div className="font-medium text-slate-900">{e.name}</div>
            <div className="text-[11px] text-slate-500">{e.roleName || 'Unassigned'}</div>
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              e.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
            )}
          >
            {e.status === 'ACTIVE' ? 'Active' : e.status === 'PENDING_INVITE' ? 'Pending' : 'Disabled'}
          </span>
        </li>
      ))}
    </ol>
  );
}

function DealershipsTable({ rows, canSetTargets, onSetTarget }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={Building2}
        title="No dealerships yet"
        description="Dealerships in your city will show up here."
        className="border-0 bg-transparent py-6"
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-2 pr-3">Dealership</th>
            <th className="py-2 pr-3">Staff</th>
            <th className="py-2 pr-3">Sales (MTD)</th>
            <th className="py-2 pr-3">Target</th>
            {canSetTargets && <th className="py-2 text-right">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="py-2 pr-3 font-medium text-slate-900">{d.name}</td>
              <td className="py-2 pr-3 text-slate-600">{formatCount(d.employeeCount)}</td>
              <td className="py-2 pr-3 text-slate-600">{formatINR(d.salesThisMonth)}</td>
              <td className="py-2 pr-3 text-slate-600">
                {d.target
                  ? `${formatINR(d.target.achievedAmount)} / ${formatINR(d.target.targetAmount)}`
                  : '—'}
              </td>
              {canSetTargets && (
                <td className="py-2 text-right">
                  <Button size="sm" variant="secondary" onClick={() => onSetTarget(d)}>
                    Set target
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetTargetModal({ dealership, onClose, onSaved }) {
  const open = Boolean(dealership);
  const now = new Date();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAmount(dealership?.target?.targetAmount ? String(dealership.target.targetAmount) : '');
    setError('');
    setSubmitting(false);
  }, [open, dealership]);

  async function handleSubmit(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value < 0) {
      setError('Enter a valid target amount.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const resp = await SalesTargetsApi.set({
        dealershipId: dealership.id,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        targetAmount: value,
      });
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to set target.');
      }
      await onSaved();
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to set target.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!submitting}
      title={`Set target — ${dealership?.name || ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="target-form" loading={submitting} disabled={submitting}>
            Save target
          </Button>
        </>
      }
    >
      <form id="target-form" onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-500">
          This month's ({now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}) sales target for this
          dealership.
        </p>
        <div>
          <Label htmlFor="target-amount">Target amount (₹)</Label>
          <Input
            id="target-amount"
            type="number"
            min="0"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
