import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { EarningsHistoryChart, GranularityToggle } from '@/components/earnings/EarningsHistoryChart.jsx';
import { Dashboard as DashboardApi } from '@/api/endpoints.js';
import { formatINR } from '@/lib/format';

// Self-service commission view — the first place a non-admin salesperson can
// see what THEY earned. Every staff role has this page (no module gate),
// mirroring the backend's GET /admin/dashboard/my-earnings which carves out
// self-data from the otherwise ADMIN-only commission visibility.
export default function MyEarnings() {
  const [granularity, setGranularity] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    DashboardApi.myEarnings(granularity)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status !== 'SUCCESS') {
          throw new Error(resp?.data?.msg || 'Failed to load earnings.');
        }
        setData(resp.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.msg || err?.message || 'Failed to load earnings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [granularity]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Earnings"
        subtitle="Your own commission — what you've earned on sales you closed."
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          <Skeleton className="h-24 w-full sm:col-span-1" />
        ) : (
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total earned
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {formatINR(data?.totalEarned)}
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Earnings history</CardTitle>
          <GranularityToggle value={granularity} onChange={setGranularity} />
        </CardHeader>
        <CardBody>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <EarningsHistoryChart history={data?.history || []} granularity={granularity} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
