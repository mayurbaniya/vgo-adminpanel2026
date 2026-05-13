import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Compose Tailwind class strings with conflict resolution. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
