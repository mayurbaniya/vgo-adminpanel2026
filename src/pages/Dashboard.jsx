import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  HandCoins,
  History,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { Dashboard as DashboardApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const inrInt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrShort = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function formatCount(n) {
  return inrInt.format(Math.round(Number(n) || 0));
}

// Indian short form: K (thousand), L (lakh, 1e5), Cr (crore, 1e7).
function formatINR(n) {
  const num = Number(n) || 0;
  if (num >= 1_00_00_000) return `₹${inrShort.format(num / 1_00_00_000)}Cr`;
  if (num >= 1_00_000) return `₹${inrShort.format(num / 1_00_000)}L`;
  if (num >= 1_000) return `₹${inrShort.format(num / 1_000)}K`;
  return `₹${inrInt.format(num)}`;
}

// Percent delta — null when both values are 0 (nothing meaningful to show).
function pctDelta(curr, prev) {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) {
    if (c === 0) return null;
    return { value: 100, up: true };
  }
  const pct = ((c - p) / p) * 100;
  return { value: Math.abs(pct), up: pct >= 0 };
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [monthStats, setMonthStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [ovResp, msResp] = await Promise.all([
          DashboardApi.overview(),
          DashboardApi.monthStats(),
        ]);
        if (cancelled) return;

        if (ovResp?.data?.status !== 'SUCCESS') {
          throw new Error(ovResp?.data?.msg || 'Failed to load overview.');
        }
        if (msResp?.data?.status !== 'SUCCESS') {
          throw new Error(msResp?.data?.msg || 'Failed to load month stats.');
        }

        setOverview(ovResp.data.data);
        setMonthStats(msResp.data.data);
      } catch (err) {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg ||
            err?.message ||
            'Failed to load dashboard.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = buildStats(overview, monthStats);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="At-a-glance state of the marketplace."
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Chart + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Earnings — last 10 months</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <EarningsChart data={overview?.earningsForLast10Months || []} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardBody>
            <EmptyState
              icon={History}
              title="Coming soon"
              description="Audit feed of admin actions will appear here once the backend feed is live."
              className="border-0 bg-transparent py-8"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function buildStats(overview, monthStats) {
  if (!overview) return [];

  const userDelta = pctDelta(overview.usersThisMonth, overview.usersLastMonth);
  const vehicleDelta = pctDelta(
    overview.vehiclesThisMonth,
    overview.vehiclesLastMonth,
  );
  const salesDelta = pctDelta(overview.salesThisMonth, overview.salesLastMonth);

  // monthStats.totalSales is a string from the backend; fall back to the
  // overview's MTD figure if month stats isn't available.
  const salesMtdRaw =
    monthStats?.totalSales ?? overview.salesThisMonth ?? 0;

  return [
    {
      label: 'Total vehicles',
      value: formatCount(overview.allVehicles),
      delta: vehicleDelta,
      icon: Bike,
    },
    {
      label: 'Active users',
      value: formatCount(overview.allUsersCount),
      delta: userDelta,
      icon: Users,
    },
    {
      label: 'Sales (MTD)',
      value: formatINR(salesMtdRaw),
      delta: salesDelta,
      icon: HandCoins,
    },
    {
      label: 'Total sales (lifetime)',
      value: formatINR(overview.totalSales),
      delta: null,
      subtitle: 'lifetime',
      icon: Wallet,
    },
  ];
}

function StatCard({ label, value, delta, subtitle, icon: Icon }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {label}
            </div>
            <div className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900">
              {value}
            </div>
            {delta ? (
              <div
                className={cn(
                  'mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold',
                  delta.up ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {delta.up ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {delta.value.toFixed(1)}%
                <span className="ml-1 font-medium text-slate-400">
                  vs last month
                </span>
              </div>
            ) : subtitle ? (
              <div className="mt-1 text-[11px] font-medium text-slate-400">
                {subtitle}
              </div>
            ) : null}
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

function EarningsChart({ data }) {
  if (!data.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No earnings yet"
        description="Once sales come in, monthly earnings will appear here."
        className="border-0 bg-transparent py-6"
      />
    );
  }

  const max = Math.max(1, ...data.map((d) => Number(d.totalEarned) || 0));

  return (
    <div className="flex h-56 items-end gap-2">
      {data.map((d, i) => {
        const value = Number(d.totalEarned) || 0;
        const heightPct = Math.max(2, (value / max) * 100);
        const monthIdx = Number(d.month) - 1;
        const label = MONTH_NAMES[monthIdx] ?? '';
        return (
          <div
            key={`${d.year}-${d.month}-${i}`}
            className="flex flex-1 flex-col items-center gap-1.5"
            title={`${label} ${d.year}: ${formatINR(value)}`}
          >
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-200 to-brand-500"
              style={{ height: `${heightPct}%` }}
            />
            <div className="text-[10px] font-medium text-slate-400">
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
