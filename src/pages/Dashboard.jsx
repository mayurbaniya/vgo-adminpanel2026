import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ClipboardList,
  HandCoins,
  History,
  TrendingUp,
  Trophy,
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
const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [ovResp, msResp, plResp] = await Promise.all([
          DashboardApi.overview(),
          DashboardApi.monthStats(),
          DashboardApi.pipeline(),
        ]);
        if (cancelled) return;

        if (ovResp?.data?.status !== 'SUCCESS') {
          throw new Error(ovResp?.data?.msg || 'Failed to load overview.');
        }
        if (msResp?.data?.status !== 'SUCCESS') {
          throw new Error(msResp?.data?.msg || 'Failed to load month stats.');
        }
        if (plResp?.data?.status !== 'SUCCESS') {
          throw new Error(plResp?.data?.msg || 'Failed to load pipeline stats.');
        }

        setOverview(ovResp.data.data);
        setMonthStats(msResp.data.data);
        setPipeline(plResp.data.data);
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

  const stats = buildStats(overview, monthStats, pipeline);
  const attentionCount =
    (Number(pipeline?.unrouted) || 0) + (Number(pipeline?.unassigned) || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Pipeline, deals and commission at a glance."
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

      {/* Funnel + commission trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Lead pipeline</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <FunnelList funnel={pipeline?.funnel || []} />
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Commission earned — last 10 months</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <EarningsChart data={overview?.earningsForLast10Months || []} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Leaderboard · cities · lost reasons */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top closers — this month</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Leaderboard rows={pipeline?.leaderboard || []} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads by city</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BarList
                rows={(pipeline?.leadsByCity || []).map((r) => ({
                  label: r.city,
                  count: r.count,
                }))}
                emptyIcon={Building2}
                emptyTitle="No routed leads yet"
                emptyDescription="Leads appear here once users with a profile city show interest."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top lost reasons</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BarList
                rows={(pipeline?.lostReasons || []).map((r) => ({
                  label: r.reason,
                  count: r.count,
                }))}
                muted
                emptyIcon={TrendingUp}
                emptyTitle="No lost leads"
                emptyDescription="When leads are marked LOST, their reasons aggregate here."
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Action queue + activity feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className={cn(
            attentionCount > 0 && 'border-amber-200 bg-amber-50/40',
          )}
        >
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <AttentionQueue
                unrouted={pipeline?.unrouted}
                unassigned={pipeline?.unassigned}
              />
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ActivityFeed events={pipeline?.recentEvents || []} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function buildStats(overview, monthStats, pipeline) {
  if (!overview || !pipeline) return [];

  const leadsDelta = pctDelta(pipeline.leadsMtd, pipeline.leadsLastMonth);
  const salesDelta = pctDelta(overview.salesThisMonth, overview.salesLastMonth);

  const dealsMtd = Number(monthStats?.totalNumberOfSales) || 0;
  const leadsMtd = Number(pipeline.leadsMtd) || 0;
  const conversion = leadsMtd > 0 ? (dealsMtd / leadsMtd) * 100 : null;

  const commissionMtd = Number(monthStats?.totalProfit) || 0;
  const execPayoutMtd = Number(pipeline.execPayoutMtd) || 0;

  return [
    {
      label: 'Leads (MTD)',
      value: formatCount(leadsMtd),
      delta: leadsDelta,
      icon: ClipboardList,
    },
    {
      label: 'Deals closed (MTD)',
      value: formatCount(dealsMtd),
      delta: null,
      subtitle:
        conversion !== null
          ? `${conversion.toFixed(1)}% of this month's leads`
          : 'no leads this month',
      icon: Trophy,
    },
    {
      label: 'Sales value (MTD)',
      value: formatINR(monthStats?.totalSales ?? overview.salesThisMonth ?? 0),
      delta: salesDelta,
      icon: HandCoins,
    },
    {
      label: 'Commission (MTD)',
      value: formatINR(commissionMtd),
      delta: null,
      subtitle: `− ${formatINR(execPayoutMtd)} exec payouts → net ${formatINR(
        commissionMtd - execPayoutMtd,
      )}`,
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

// ---------------------------------------------------------------------------
// Pipeline funnel — ordered stage list, single-hue bars (magnitude), LOST
// muted since it's leakage rather than progress. Identity is carried by the
// text labels, not color.
// ---------------------------------------------------------------------------
const STAGE_ORDER = [
  'NEW', 'ASSIGNED', 'CONTACTED', 'TEST_RIDE',
  'NEGOTIATION', 'BOOKED', 'WON', 'LOST',
];

function FunnelList({ funnel }) {
  const byStage = Object.fromEntries(
    funnel.map((f) => [f.stage, Number(f.count) || 0]),
  );
  const rows = STAGE_ORDER.map((stage) => ({
    stage,
    count: byStage[stage] ?? 0,
  }));
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No leads yet"
        description="The funnel fills in as users mark interest in vehicles."
        className="border-0 bg-transparent py-6"
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(({ stage, count }) => (
        <div
          key={stage}
          className="flex items-center gap-2"
          title={`${stage.replace('_', ' ')}: ${count} lead${count === 1 ? '' : 's'}`}
        >
          <div className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {stage.replace('_', ' ')}
          </div>
          <div className="h-4 flex-1 rounded-r-md bg-slate-100/70">
            <div
              className={cn(
                'h-4 rounded-r-md',
                stage === 'LOST' ? 'bg-slate-300' : 'bg-brand-500',
              )}
              style={{ width: `${Math.max(count > 0 ? 3 : 0, (count / max) * 100)}%` }}
            />
          </div>
          <div className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">
            {count}
          </div>
        </div>
      ))}
    </div>
  );
}

// Generic single-hue bar list (cities, lost reasons).
function BarList({ rows, muted = false, emptyIcon, emptyTitle, emptyDescription }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        className="border-0 bg-transparent py-6"
      />
    );
  }
  const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  return (
    <div className="space-y-2.5">
      {rows.slice(0, 6).map((r) => {
        const count = Number(r.count) || 0;
        return (
          <div key={r.label} title={`${r.label}: ${count}`}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">
                {r.label}
              </span>
              <span className="font-semibold text-slate-500">{count}</span>
            </div>
            <div className="h-2.5 rounded-r-md bg-slate-100/70">
              <div
                className={cn(
                  'h-2.5 rounded-r-md',
                  muted ? 'bg-slate-300' : 'bg-brand-500',
                )}
                style={{ width: `${Math.max(3, (count / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Leaderboard({ rows }) {
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
              i === 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500',
            )}
          >
            {i + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">
              {r.name}
            </div>
            <div className="text-[11px] text-slate-500">
              {formatCount(r.deals)} deal{Number(r.deals) === 1 ? '' : 's'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-900">
              {formatINR(r.payout)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              payout
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function AttentionQueue({ unrouted, unassigned }) {
  const items = [
    {
      count: Number(unrouted) || 0,
      label: 'unrouted leads',
      hint: 'No dealership in the lead’s city — assign them manually.',
    },
    {
      count: Number(unassigned) || 0,
      label: 'unassigned leads',
      hint: 'Waiting at NEW/ASSIGNED with no owner.',
    },
  ].filter((i) => i.count > 0);

  if (!items.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="All clear"
        description="Every open lead is routed and owned."
        className="border-0 bg-transparent py-6"
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {i.count} {i.label}
            </div>
            <div className="text-xs text-slate-500">{i.hint}</div>
          </div>
        </div>
      ))}
      <Link
        to="/leads"
        className="inline-flex text-xs font-semibold text-brand-600 hover:text-brand-700"
      >
        Open the leads workspace →
      </Link>
    </div>
  );
}

function ActivityFeed({ events }) {
  if (!events.length) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Stage moves, assignments and closed sales show up here."
        className="border-0 bg-transparent py-6"
      />
    );
  }
  return (
    <ol className="divide-y divide-slate-100">
      {events.map((ev, i) => (
        <li key={i} className="flex items-baseline gap-2 py-2 text-xs first:pt-0 last:pb-0">
          <span className="shrink-0 font-semibold text-slate-700">
            {ev.actor}
          </span>
          <span className="min-w-0 flex-1 truncate text-slate-500">
            lead&nbsp;#{ev.leadId}: {String(ev.fromStatus || '').replace('_', ' ')}{' '}
            → {String(ev.toStatus || '').replace('_', ' ')}
            {ev.note ? ` — ${ev.note}` : ''}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400">
            {ev.created ? timeFormatter.format(new Date(ev.created)) : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

function EarningsChart({ data }) {
  if (!data.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No commission yet"
        description="Once sales are recorded, monthly commission totals appear here."
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
