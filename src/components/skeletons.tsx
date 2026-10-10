import { Fragment } from 'react';
import { View } from 'react-native';

import { Separator } from '@/src/components/ui/separator';
import { Skeleton } from '@/src/components/ui/skeleton';
import { cn } from '@/src/lib/utils';

/**
 * Placeholders that mirror the real layouts while data loads, built on the
 * Reusables Skeleton. Each one copies the paddings and sizes of the component
 * it stands in for, so nothing jumps when the data arrives. Screen-specific
 * compositions live next to their screens.
 */

/** Spread on the root of a skeleton so screen readers announce one "Loading". */
export const loadingA11y = { accessible: true, accessibilityLabel: 'Loading', accessibilityState: { busy: true } } as const;

// Rotating widths so stacked rows do not look like a barcode.
const TITLE_W = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-[45%]'];
const SUB_W = ['w-3/5', 'w-2/5', 'w-1/2', 'w-[55%]', 'w-1/3'];
const AMOUNT_W = ['w-16', 'w-20', 'w-14', 'w-[72px]', 'w-[60px]'];

/** A line of text: height ≈ the font's cap height, not its line box. */
export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn('h-3 rounded', className)} />;
}

/** Mirrors ExpenseRow: category circle, description + meta, amount. */
export function ExpenseRowSkeleton({ index = 0 }: { index?: number }) {
  const i = index % TITLE_W.length;
  return (
    <View className="bg-card flex-row items-center gap-3 p-4">
      <Skeleton className="size-9 rounded-full" />
      <View className="flex-1 gap-2">
        <SkeletonLine className={cn('h-3.5', TITLE_W[i])} />
        <SkeletonLine className={SUB_W[i]} />
      </View>
      <SkeletonLine className={cn('h-3.5', AMOUNT_W[i])} />
    </View>
  );
}

/** Mirrors one month section of the expenses list: header with total, then rows. */
export function ExpenseListSkeleton({ rows = 8, header = true }: { rows?: number; header?: boolean }) {
  return (
    <View {...loadingA11y}>
      {header ? (
        <View className="flex-row justify-between px-4 py-2.5">
          <SkeletonLine className="w-24" />
          <SkeletonLine className="w-20" />
        </View>
      ) : null}
      {Array.from({ length: rows }, (_, i) => (
        <Fragment key={i}>
          {i > 0 ? <Separator className="ml-[62px]" /> : null}
          <ExpenseRowSkeleton index={i} />
        </Fragment>
      ))}
    </View>
  );
}

/** Mirrors PlannedRow: status circle, title + when, amount, optional ✓. */
export function PlannedRowSkeleton({ index = 0, withCheck }: { index?: number; withCheck?: boolean }) {
  const i = index % TITLE_W.length;
  return (
    <View className="bg-card flex-row items-center gap-3 p-3.5">
      <Skeleton className="size-9 rounded-full" />
      <View className="flex-1 gap-2">
        <SkeletonLine className={cn('h-3.5', TITLE_W[i])} />
        <SkeletonLine className={SUB_W[i]} />
      </View>
      <SkeletonLine className={cn('h-3.5', AMOUNT_W[i])} />
      {withCheck ? <Skeleton className="ml-1 size-[26px] rounded-full" /> : null}
    </View>
  );
}

/** Mirrors a list of PlannedRows, with an optional section header. */
export function PlannedListSkeleton({ rows = 5, header, withCheck }: { rows?: number; header?: boolean; withCheck?: boolean }) {
  return (
    <View {...loadingA11y}>
      {header ? (
        <View className="px-4 py-2.5">
          <SkeletonLine className="w-20" />
        </View>
      ) : null}
      {Array.from({ length: rows }, (_, i) => (
        <Fragment key={i}>
          {i > 0 ? <Separator className="ml-[62px]" /> : null}
          <PlannedRowSkeleton index={i} withCheck={withCheck} />
        </Fragment>
      ))}
    </View>
  );
}

/**
 * Mirrors Group + GroupRow: optional section title, then a card of label/value
 * rows. `descriptions` marks rows that carry a second line.
 */
export function GroupSkeleton({ title, rows = 2, descriptions = [] }: { title?: boolean; rows?: number; descriptions?: number[] }) {
  return (
    <View className="gap-1.5">
      {title ? <SkeletonLine className="ml-1 mt-4 w-24" /> : null}
      <View className="bg-card border-border overflow-hidden rounded-lg border">
        {Array.from({ length: rows }, (_, i) => (
          <Fragment key={i}>
            {i > 0 ? <Separator className="ml-4" /> : null}
            <View className="min-h-12 flex-row items-center gap-3 px-4 py-3">
              <View className="flex-1 gap-2">
                <SkeletonLine className={cn('h-3.5', TITLE_W[i % TITLE_W.length])} />
                {descriptions.includes(i) ? <SkeletonLine className="w-3/5" /> : null}
              </View>
              <SkeletonLine className={cn('h-3.5', AMOUNT_W[i % AMOUNT_W.length])} />
            </View>
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/**
 * Building blocks of the expense, plan and fixed-charge forms:
 * - `amount`: the large AmountInput box and its hint line
 * - `field`: FormField label + Input
 * - `textarea`: FormField label + Textarea
 * - a number: a Group with that many rows
 */
export type FormBlock = 'amount' | 'field' | 'textarea' | number;

export const FORM_LAYOUTS = {
  expense: ['amount', 1, 'field', 'field', 2, 2, 'textarea'],
  planned: ['field', 'amount', 1, 2, 'field', 'field', 'textarea', 1, 'textarea'],
  recurring: ['field', 'amount', 3, 2, 1, 'field', 'textarea'],
} as const satisfies Record<string, readonly FormBlock[]>;

/** Mirrors the form screens; `extra` renders before the submit button, as in the forms. */
export function FormSkeleton({ blocks, extra }: { blocks: readonly FormBlock[]; extra?: React.ReactNode }) {
  return (
    <View className="bg-background flex-1 gap-4 p-4" {...loadingA11y}>
      {blocks.map((b, i) => (
        <FormBlockSkeleton key={i} block={b} />
      ))}
      {extra}
      <Skeleton className="mt-2 h-11 rounded-md" />
    </View>
  );
}

function FormBlockSkeleton({ block }: { block: FormBlock }) {
  if (typeof block === 'number') return <GroupSkeleton rows={block} />;
  switch (block) {
    case 'amount':
      return (
        <View className="gap-1">
          <View className="bg-card border-input h-[62px] flex-row items-center justify-between rounded-md border px-4">
            <SkeletonLine className="h-7 w-24" />
            <SkeletonLine className="h-4 w-10" />
          </View>
          <SkeletonLine className="ml-1 mt-1 w-16" />
        </View>
      );
    case 'field':
    case 'textarea':
      return (
        <View className="gap-1.5">
          <SkeletonLine className="w-20" />
          <Skeleton className={cn('border-input bg-card rounded-md border', block === 'field' ? 'h-10' : 'h-20')} />
        </View>
      );
  }
}

/** Mirrors the AttachmentsSection strip: square FileTiles. */
export function TileStripSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="flex-row gap-2.5" {...loadingA11y}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="size-[84px] rounded-md" />
      ))}
    </View>
  );
}

/** Mirrors the proof card on the expense detail screen (title row + tile strip + hint). */
export function AttachmentsCardSkeleton() {
  return (
    <View className="bg-card border-border gap-2 rounded-lg border p-3">
      <View className="flex-row justify-between">
        <SkeletonLine className="h-3.5 w-12" />
        <SkeletonLine className="w-10" />
      </View>
      <TileStripSkeleton />
      <SkeletonLine className="w-32" />
    </View>
  );
}
