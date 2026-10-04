import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import { expenseInputSchema, type ExpenseInput } from '@/src/lib/schemas/expense';
import { AmountInput } from './AmountInput';
import { DateField } from './DateField';
import { newId } from './ids';

export type ExpenseFormValues = Omit<ExpenseInput, 'id'> & { id?: string };

const NONE = '__none__';

/**
 * Shared by the create and edit screens (F2.5 / F2.7). Validates with the same
 * zod schema the API uses, so a form that passes here is accepted there.
 */
export function ExpenseForm({
  initial,
  categories,
  currencies,
  defaultCurrency,
  submitLabel,
  submitting,
  onSubmit,
  extra,
}: {
  initial?: Partial<ExpenseFormValues>;
  categories: CategoryDto[];
  currencies: CurrencyInfo[];
  defaultCurrency: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: ExpenseInput) => Promise<void> | void;
  /** Rendered between the last field and the submit button (e.g. proof picker). */
  extra?: React.ReactNode;
}) {
  const [amountMinor, setAmountMinor] = useState<number | null>(initial?.amountMinor ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? todayISO());
  const [paidOn, setPaidOn] = useState<string | null>(initial?.paidOn ?? null);
  const [showPaidOn, setShowPaidOn] = useState(Boolean(initial?.paidOn));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [payee, setPayee] = useState(initial?.payee ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isEstimated, setIsEstimated] = useState(initial?.isEstimated ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currencyInfo = useMemo<CurrencyInfo>(
    () => currencies.find((c) => c.code === currency) ?? { code: currency, exponent: 0, symbol: currency },
    [currencies, currency],
  );

  const submit = async () => {
    const candidate = {
      id: initial?.id ?? newId(),
      amountMinor: amountMinor ?? 0,
      currency,
      occurredOn,
      paidOn: showPaidOn ? paidOn : null,
      description,
      payee: payee.trim() || null,
      categoryId,
      notes: notes.trim() || null,
      isEstimated,
    };
    const parsed = expenseInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} autoFocus={!initial?.id} error={errors.amountMinor} />

      <View style={styles.card}>
        <OptionPicker
          label="Currency"
          value={currency}
          options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))}
          onChange={setCurrency}
        />
      </View>

      <Field label="Description" error={errors.description}>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="What was it for?" />
      </Field>

      <Field label="Paid to" error={errors.payee}>
        <TextInput style={styles.input} value={payee} onChangeText={setPayee} placeholder="Shop, person, company" />
      </Field>

      <View style={styles.card}>
        <OptionPicker
          label="Category"
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: 'None' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
      </View>

      <View style={styles.card}>
        <DateField label="Date" value={occurredOn} onChange={(d) => d && setOccurredOn(d)} />
        {errors.occurredOn ? <Text style={styles.error}>{errors.occurredOn}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Paid on a different day</Text>
          <Switch value={showPaidOn} onValueChange={setShowPaidOn} />
        </View>
        {showPaidOn ? <DateField label="Paid on" value={paidOn} onChange={setPaidOn} nullable /> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Estimated amount</Text>
            <Text style={styles.help}>Flagged in totals until you confirm the exact figure.</Text>
          </View>
          <Switch value={isEstimated} onValueChange={setIsEstimated} />
        </View>
      </View>

      <Field label="Notes" error={errors.notes}>
        <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
      </Field>

      {extra}

      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} disabled={submitting} onPress={submit}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{submitLabel}</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 4, gap: 4 },
  field: { gap: 6 },
  label: { fontSize: 15 },
  help: { fontSize: 12, color: '#777' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, gap: 12 },
  button: { backgroundColor: '#1F5EFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#C0392B', fontSize: 12, marginLeft: 4 },
});
