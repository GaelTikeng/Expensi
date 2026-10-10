import { CalendarDays, Check, CircleCheck, Repeat } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { PlannedDto } from '@/src/lib/schemas/planned';
import { cn } from '@/src/lib/utils';

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const PlannedRow = memo(function PlannedRow({
  item,
  currency,
  overdue,
  onPress,
  onDone,
}: {
  item: PlannedDto;
  currency: CurrencyInfo;
  overdue?: boolean;
  onPress: () => void;
  onDone?: () => void;
}) {
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';
  return (
    <Pressable className="bg-card flex-row items-center gap-3 p-3.5 active:bg-accent" onPress={onPress}>
      <View
        className={cn(
          'size-9 items-center justify-center rounded-full',
          done ? 'bg-success' : skipped ? 'bg-muted' : overdue ? 'bg-warning' : 'bg-primary',
        )}
      >
        <Icon
          as={done ? Check : item.recurringChargeId ? Repeat : CalendarDays}
          className={cn(
            'size-[18px]',
            done ? 'text-success-foreground' : skipped ? 'text-muted-foreground' : overdue ? 'text-warning-foreground' : 'text-primary-foreground',
          )}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={cn('text-[15px] font-medium', item.status !== 'planned' && 'text-muted-foreground')} numberOfLines={1}>
          {item.title}
        </Text>
        <Text className={cn('text-xs', overdue ? 'text-warning font-semibold' : 'text-muted-foreground')} numberOfLines={1}>
          {when(item.scheduledAt)}
          {item.place ? ` · ${item.place}` : ''}
          {item.payee ? ` · ${item.payee}` : ''}
        </Text>
      </View>
      <Text className="text-[15px] font-semibold">{formatMoney(item.amountMinor, currency)}</Text>
      {onDone && item.status === 'planned' ? (
        <Pressable onPress={onDone} hitSlop={10} className="ml-1" accessibilityLabel="Mark as paid">
          <Icon as={CircleCheck} className="text-success size-[26px]" />
        </Pressable>
      ) : null}
    </Pressable>
  );
});
