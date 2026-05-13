import { cn } from '@/lib/cn';

export function Skeleton({ className }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />
  );
}

export function SkeletonTableRow({ cells = 5 }) {
  return (
    <tr>
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-3 w-full" />
        </td>
      ))}
    </tr>
  );
}
