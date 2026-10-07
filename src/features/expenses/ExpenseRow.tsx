import { Ionicons } from '@expo/vector-icons';
import { Paperclip, Trash2 } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Badge } from '@/src/components/ui/badge';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { relativeDayLabel } from '@/src/lib/dates';
import { formatMoney, type CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import type { ExpenseDto } from '@/src/lib/schemas/expense';

/**
 * One expense in a list. Category glyphs stay on Ionicons because category
 * rows store Ionicons names (src/server/data/default-categories.ts).
 */
export const ExpenseRow = memo(function ExpenseRow({
  expense,
  category,
  currency,
  onPress,
  onDelete,
}: {
  expense: ExpenseDto;
  category?: CategoryDto;
  currency: CurrencyInfo;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable className="bg-destructive w-[72px] items-center justify-center" onPress={onDelete} accessibilityLabel="Delete expense">
          <Icon as={Trash2} className="text-destructive-foreground size-5" />
        </Pressable>
      )}
    >
      <Pressable className="bg-card flex-row items-center gap-3 p-4 active:bg-accent" onPress={onPress}>
        <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: category?.colorHex ?? '#95A5A6' }}>
          <Ionicons name={(category?.icon as never) ?? 'ellipsis-horizontal-outline'} size={18} color="#fff" />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1">
            <Text className="shrink text-[15px] font-medium" numberOfLines={1}>
              {expense.description}
            </Text>
            {expense.attachmentCount > 0 ? <Icon as={Paperclip} className="text-primary size-3.5" /> : null}
          </View>
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {relativeDayLabel(expense.occurredOn)}
            {expense.payee ? ` · ${expense.payee}` : ''}
            {category ? ` · ${category.name}` : ''}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text className="text-[15px] font-semibold">{formatMoney(expense.amountMinor, currency)}</Text>
          {expense.isEstimated ? (
            <Badge variant="outline" className="border-warning px-1.5 py-0">
              <Text className="text-warning text-[10px] uppercase">est.</Text>
            </Badge>
          ) : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});
