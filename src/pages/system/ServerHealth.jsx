import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { SystemHealth as SystemHealthApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

const REFRESH_MS = 30_000;

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatUptime(millis) {
  const totalMin = Math.floor((Number(millis) || 0) / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// Meter severity: fill escalates accent → warning → danger; the unfilled
// track stays a lighter step of the same ramp so state reads across the bar.
function severity(pct) {
  if (pct == null) return { fill: 'bg-slate-300', track: 'bg-slate-100' };
  if (pct >= 85) return { fill: 'bg-red-500', track: 'bg-red-100' };
  if (pct >= 70) return { fill: 'bg-amber-500', track: 'bg-amber-100' };
  return { fill: 'bg-brand-500', track: 'bg-brand-100' };
}

function Meter({ percent }) {
  const s = severity(percent);
  const width = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full', s.track)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', s.fill)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function UsageTile({ icon: Icon, label, percent, detail }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <Icon className="h-4 w-4 text-slate-600" />
          </div>
          <span className="text-sm font-medium text-slate-600">{label}</span>
        </div>
        <div className="text-2xl font-semibold text-slate-900">
          {percent == null ? '—' : `${percent.toFixed(1)}%`}
        </div>
        <Meter percent={percent} />
        <div className="text-xs text-slate-500">{detail}</div>
      </CardBody>
    </Card>
  );
}

// Status is never color alone — always icon + label.
function StatusPill({ status }) {
  const up = status === 'UP';
  const degraded = status === 'DEGRADED';
  const Icon = up ? CheckCircle2 : degraded ? AlertTriangle : XCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        up && 'bg-emerald-50 text-emerald-700',
        degraded && 'bg-amber-50 text-amber-700',
        !up && !degraded && 'bg-red-50 text-red-700',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {status ?? 'UNKNOWN'}
    </span>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value ?? '—'}</span>
    </div>
  );
}

function TileSkeleton() {
  return (
    <Card>
      <CardBody className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-32" />
      </CardBody>
    </Card>
  );
}

export default function ServerHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const resp = await SystemHealthApi.health();
      if (!mounted.current) return;
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to load server health.');
      }
      setHealth(resp.data.data);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      if (!mounted.current) return;
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to load server health.',
      );
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const jvm = health?.jvm;
  const sys = health?.system;
  const disk = health?.disk;
  const db = health?.database;
  const app = health?.app;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Server Health"
        subtitle="Live CPU, memory, disk and database status of the backend."
        actions={
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="text-xs text-slate-500">
                Updated {timeFormatter.format(updatedAt)} · auto-refreshes every 30s
              </span>
            )}
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Usage meters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <TileSkeleton key={i} />)
        ) : (
          <>
            <UsageTile
              icon={Cpu}
              label="CPU load"
              percent={sys?.cpuLoadPercent}
              detail={`${sys?.availableProcessors ?? '—'} vCPU · process ${
                sys?.processCpuLoadPercent == null
                  ? '—'
                  : `${sys.processCpuLoadPercent.toFixed(1)}%`
              }`}
            />
            <UsageTile
              icon={MemoryStick}
              label="System memory"
              percent={sys?.memoryUsedPercent}
              detail={`${formatBytes(sys?.memoryUsedBytes)} of ${formatBytes(
                sys?.memoryTotalBytes,
              )}`}
            />
            <UsageTile
              icon={Activity}
              label="JVM heap"
              percent={jvm?.heapUsedPercent}
              detail={`${formatBytes(jvm?.heapUsedBytes)} of ${formatBytes(
                jvm?.heapMaxBytes,
              )} · ${jvm?.threadCount ?? '—'} threads`}
            />
            <UsageTile
              icon={HardDrive}
              label="Disk"
              percent={disk?.usedPercent}
              detail={`${formatBytes(disk?.freeBytes)} free of ${formatBytes(
                disk?.totalBytes,
              )}`}
            />
          </>
        )}
      </div>

      {/* Database + application cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              Database
            </CardTitle>
            {!loading && <StatusPill status={db?.status} />}
          </CardHeader>
          <CardBody className="divide-y divide-slate-50">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <InfoRow
                  label="Ping latency"
                  value={db?.latencyMillis == null ? null : `${db.latencyMillis} ms`}
                />
                <InfoRow label="Engine" value={db?.product} />
                <InfoRow
                  label="Pool connections"
                  value={
                    db?.poolTotal == null
                      ? null
                      : `${db.poolActive ?? 0} active · ${db.poolIdle ?? 0} idle · ${db.poolTotal} total`
                  }
                />
                <InfoRow
                  label="Threads waiting for a connection"
                  value={db?.poolAwaiting}
                />
                {db?.error && (
                  <div className="pt-2 text-sm font-medium text-red-700">
                    {db.error}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" />
              Application
            </CardTitle>
            {!loading && <StatusPill status={health?.status} />}
          </CardHeader>
          <CardBody className="divide-y divide-slate-50">
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <InfoRow
                  label="Uptime"
                  value={
                    app?.uptimeMillis == null ? null : (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {formatUptime(app.uptimeMillis)}
                      </span>
                    )
                  }
                />
                <InfoRow
                  label="Started"
                  value={
                    app?.startedAt
                      ? timeFormatter.format(new Date(app.startedAt))
                      : null
                  }
                />
                <InfoRow label="Profile" value={app?.profile} />
                <InfoRow label="Java version" value={app?.javaVersion} />
                <InfoRow label="Service" value={app?.name} />
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
