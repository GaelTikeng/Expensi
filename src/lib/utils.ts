import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes, letting later ones win (`cn('p-2', cond && 'p-4')`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
