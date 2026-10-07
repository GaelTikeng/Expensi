import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { formatMoney, parseLocaleAmount, toMajor, type CurrencyInfo } from '@/src/lib/money';
import { cn } from '@/src/lib/utils';

/**
 * Locale-aware amount field. Accepts "5.000", "5 000", "12,50"; stores minor
 * units; shows the normalised rendering underneath so misreads are visible.
 */
export function AmountInput({
  value,
  currency,
  onChange,
  autoFocus,
  error,
}: {
  value: number | null;
  currency: CurrencyInfo;
  onChange: (minor: number | null) => void;
  autoFocus?: boolean;
  error?: string;
}) {
  const [text, setText] = useState(() => (value != null ? String(toMajor(value, currency.exponent)) : ''));

  const handle = (t: string) => {
    setText(t);
    onChange(parseLocaleAmount(t, currency.exponent));
  };

  return (
    <View className="gap-1">
      <View
        className={cn(
          'bg-card border-input flex-row items-center rounded-md border px-4 shadow-sm shadow-black/5',
          error && 'border-destructive',
        )}
      >
        <TextInput
          className="text-foreground placeholder:text-muted-foreground flex-1 py-3 text-3xl font-semibold"
          value={text}
          onChangeText={handle}
          keyboardType="decimal-pad"
          placeholder="0"
          autoFocus={autoFocus}
          accessibilityLabel="Amount"
        />
        <Text className="text-muted-foreground ml-2 text-lg">{currency.symbol}</Text>
      </View>
      <Text className={cn('ml-1 text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
        {error ?? (value != null ? formatMoney(value, currency) : ' ')}
      </Text>
    </View>
  );
}
