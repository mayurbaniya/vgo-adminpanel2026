import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card } from '@/components/ui/Card.jsx';
import { Input } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';

/**
 * Section stub used by every page that hasn't been wired to its admin
 * endpoint yet. Renders a realistic table shell so the navigation shell
 * feels real, plus a small "endpoints" hint that names the API surface
 * the page will consume.
 */
export function SectionStub({
  title,
  subtitle,
  endpointGroup,
  endpoints = [],
  primaryAction,
  columns = ['Name', 'Status', 'Updated', 'Actions'],
  rows = 6,
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          primaryAction && (
            <Button>
              <Plus className="h-4 w-4" />
              {primaryAction}
            </Button>
          )
        }
      />

      {/* Filter bar */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder={`Search ${title.toLowerCase()}…`}
              leftIcon={<Search className="h-4 w-4" />}
              disabled
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <FilterPill>All</FilterPill>
            <FilterPill>Active</FilterPill>
            <FilterPill>Disabled</FilterPill>
          </div>
        </div>

        {/* Skeleton table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-4 py-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: rows }).map((_, r) => (
                <tr key={r}>
                  {columns.map((_, c) => (
                    <td key={c} className="px-4 py-3.5">
                      <Skeleton className="h-3 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <div>Showing 0 of 0</div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled>
              Prev
            </Button>
            <Button size="sm" variant="ghost" disabled>
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Endpoint hint — surfaces what's wired vs pending so the user can
          plan the order of integration. */}
      {endpoints.length > 0 && (
        <Card className="border-dashed border-slate-300 bg-slate-50/60 shadow-none">
          <div className="px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Endpoints — {endpointGroup}
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {endpoints.map((e) => (
                <li
                  key={e}
                  className="flex items-center gap-2 font-mono text-[11px] text-slate-600"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

function FilterPill({ children }) {
  return (
    <span className="cursor-not-allowed rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-500">
      {children}
    </span>
  );
}
