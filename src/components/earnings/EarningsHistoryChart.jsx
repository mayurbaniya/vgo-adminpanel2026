import { TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState.jsx';
import { formatINR } from '@/lib/format';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

function labelFor(row, granularity) {
  if (granularity === 'week') {
    const d = row.weekStart ? new Date(row.weekStart) : null;
    return d && !Number.isNaN(d.getTime()) ? dateFormatter.format(d) : '—';
  }
  if (granularity === 'year') return String(row.year ?? '—');
  const monthIdx = Number(row.month) - 1;
  return `${MONTH_NAMES[monthIdx] ?? '—'} ${String(row.year ?? '').slice(-2)}`;
}

function tooltipFor(row, granularity, value) {
  if (granularity === 'week') {
    const d = row.weekStart ? new Date(row.weekStart) : null;
    return `Week of ${d && !Number.isNaN(d.getTime()) ? dateFormatter.format(d) : '—'}: ${formatINR(value)}`;
  }
  if (granularity === 'year') return `${row.year}: ${formatINR(value)}`;
  const monthIdx = Number(row.month) - 1;
  return `${MONTH_NAMES[monthIdx] ?? ''} ${row.year}: ${formatINR(value)}`;
}

/** Bar chart shared by the org-wide earnings card and the self-service "My
 *  Earnings" page — same CSS-bar approach as the original 10-month chart,
 *  generalized to whichever granularity the caller fetched. */
export function EarningsHistoryChart({ history, granularity }) {
  const data = history || [];
  if (!data.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No earnings yet"
        description="Once sales are recorded, totals for this period appear here."
        className="border-0 bg-transparent py-6"
      />
    );
  }

  const max = Math.max(1, ...data.map((d) => Number(d.totalEarned) || 0));

  return (
    <div className="flex h-56 items-end gap-2">
      {data.map((row, i) => {
        const value = Number(row.totalEarned) || 0;
        const heightPct = Math.max(2, (value / max) * 100);
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1.5"
            title={tooltipFor(row, granularity, value)}
          >
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-200 to-brand-500"
              style={{ height: `${heightPct}%` }}
            />
            <div className="text-[10px] font-medium text-slate-400">
              {labelFor(row, granularity)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GranularityToggle({ value, onChange }) {
  const options = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            'rounded-md px-2.5 py-1 transition ' +
            (value === o.value
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
