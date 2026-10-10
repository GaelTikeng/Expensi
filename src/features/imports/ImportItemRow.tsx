import { ChevronRight, CircleMinus } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Checkbox } from '@/src/components/ui/checkbox';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { formatDDMMYYYY } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import { cn } from '@/src/lib/utils';
import type { ReviewedItem } from './review-utils';

/** Severity → token: ok = success, verify = warning, blocked = muted. */
const SEVERITY_DOT = { ok: 'bg-success', verify: 'bg-warning', blocked: 'bg-muted-foreground' } as const;
const SEVERITY_TEXT = { ok: 'text-success', verify: 'text-warning', blocked: 'text-muted-foreground' } as const;

export const ImportItemRow = memo(function ImportItemRow({
  reviewed,
  selected,
  currency,
  categoryName,
  onToggle,
  onEdit,
}: {
  reviewed: ReviewedItem;
  selected: boolean;
  currency: CurrencyInfo;
  categoryName?: string;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { item, severity, reason } = reviewed;
  const blocked = severity === 'blocked';
  const canTick = item.lineKind === 'expense';

  return (
    <View className={cn('bg-card flex-row items-center gap-2.5 px-3 py-2.5', blocked && 'bg-background')}>
      <View className="w-7 items-center">
        {canTick ? (
          <Checkbox checked={selected} onCheckedChange={onToggle} className="size-5 rounded-[5px]" />
        ) : (
          <Icon as={CircleMinus} className="text-muted-foreground/50 size-5" accessibilityLabel="Not an expense" />
        )}
      </View>

      <Pressable className="flex-1 gap-0.5" onPress={onEdit}>
        <View className="flex-row items-center gap-1.5">
          <View className={cn('size-2 rounded-full', SEVERITY_DOT[severity])} />
          <Text className={cn('flex-1 text-[15px] font-medium', blocked && 'text-muted-foreground line-through')} numberOfLines={1}>
            {item.description || item.rawText || `Line ${item.lineIndex + 1}`}
          </Text>
          <Text className={cn('text-[15px] font-semibold', blocked && 'text-muted-foreground line-through')}>
            {item.amountMinor != null ? formatMoney(item.amountMinor, currency) : '—'}
          </Text>
        </View>
        <Text className="text-muted-foreground ml-3.5 text-xs" numberOfLines={1}>
          {item.occurredOn ? formatDDMMYYYY(item.occurredOn) : 'No date'}
          {item.payee ? ` · ${item.payee}` : ''}
          {categoryName ? ` · ${categoryName}` : ''}
          {item.editedByUser ? ' · edited' : ''}
        </Text>
        {reason && !(severity === 'ok') ? (
          <Text className={cn('ml-3.5 text-xs', SEVERITY_TEXT[severity])} numberOfLines={2}>
            {reason}
          </Text>
        ) : null}
        {item.rawText && item.description && item.rawText !== item.description ? (
          <Text className="text-muted-foreground ml-3.5 text-[11px] italic" numberOfLines={1}>
            “{item.rawText}”
          </Text>
        ) : null}
      </Pressable>

      <Icon as={ChevronRight} className="text-muted-foreground/60 size-[18px]" />
    </View>
  );
});
