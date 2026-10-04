import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatMoney, parseLocaleAmount, toMajor, type CurrencyInfo } from '@/src/lib/money';

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
    <View style={styles.wrap}>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handle}
          keyboardType="decimal-pad"
          placeholder="0"
          autoFocus={autoFocus}
          accessibilityLabel="Amount"
        />
        <Text style={styles.symbol}>{currency.symbol}</Text>
      </View>
      <Text style={[styles.hint, error ? styles.hintError : null]}>
        {error ?? (value != null ? formatMoney(value, currency) : ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  rowError: { borderColor: '#C0392B' },
  input: { flex: 1, fontSize: 28, fontWeight: '600', paddingVertical: 12 },
  symbol: { fontSize: 18, color: '#666', marginLeft: 8 },
  hint: { fontSize: 12, color: '#777', marginLeft: 4 },
  hintError: { color: '#C0392B' },
});
