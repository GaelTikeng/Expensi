import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { newId } from '@/src/features/expenses/ids';
import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { addDays, toISODate, todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import { plannedInputSchema, type PlannedDto, type PlannedInput } from '@/src/lib/schemas/planned';
import { TimeField } from './TimeField';

const NONE = '__none__';
const pad = (n: number) => String(n).padStart(2, '0');

/** F5.2: when, time, where, why, how much. */
export function PlannedForm({
  initial,
  categories,
  currencies,
  defaultCurrency,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: PlannedDto;
  categories: CategoryDto[];
  currencies: CurrencyInfo[];
  defaultCurrency: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: PlannedInput) => Promise<void> | void;
}) {
  const initialDate = initial ? new Date(initial.scheduledAt) : null;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amountMinor, setAmountMinor] = useState<number | null>(initial?.amountMinor ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [date, setDate] = useState(initialDate ? toISODate(initialDate) : addDays(todayISO(), 1));
  const [time, setTime] = useState(initialDate ? `${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}` : '09:00');
  const [place, setPlace] = useState(initial?.place ?? '');
  const [payee, setPayee] = useState(initial?.payee ?? '');
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currencyInfo = useMemo<CurrencyInfo>(
    () => currencies.find((c) => c.code === currency) ?? { code: currency, exponent: 0, symbol: currency },
    [currencies, currency],
  );

  const submit = async () => {
    const [h, m] = time.split(':').map(Number);
    const [y, mo, d] = date.split('-').map(Number);
    const scheduledAt = new Date(y, mo - 1, d, h, m).toISOString(); // device-local wall clock → instant
    const parsed = plannedInputSchema.safeParse({
      id: initial?.id ?? newId(),
      title,
      amountMinor: amountMinor ?? 0,
      currency,
      scheduledAt,
      place: place.trim() || null,
      payee: payee.trim() || null,
      reason: reason.trim() || null,
      notes: notes.trim() || null,
      categoryId,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Field label="What" error={errors.title}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Tithe, school fees, rent" autoFocus={!initial} />
      </Field>

      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} error={errors.amountMinor} />
      <View style={styles.card}>
        <OptionPicker label="Currency" value={currency} options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))} onChange={setCurrency} />
      </View>

      <View style={styles.card}>
        <DateField label="When" value={date} onChange={(d) => d && setDate(d)} />
        <View style={styles.separator} />
        <TimeField label="At" value={time} onChange={setTime} />
      </View>
      <Text style={styles.help}>You will be reminded the day before and one hour before.</Text>

      <Field label="Where" error={errors.place}>
        <TextInput style={styles.input} value={place} onChangeText={setPlace} placeholder="Optional" />
      </Field>
      <Field label="To whom" error={errors.payee}>
        <TextInput style={styles.input} value={payee} onChangeText={setPayee} placeholder="Optional" />
      </Field>
      <Field label="Why" error={errors.reason}>
        <TextInput style={[styles.input, styles.multiline]} value={reason} onChangeText={setReason} multiline placeholder="Optional" />
      </Field>

      <View style={styles.card}>
        <OptionPicker
          label="Category"
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: 'None' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
      </View>

      <Field label="Notes" error={errors.notes}>
        <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
      </Field>

      <Pressable style={[styles.button, submitting && styles.disabled]} disabled={submitting} onPress={submit}>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 10, gap: 8 },
  separator: { height: 1, backgroundColor: '#EEF0F3' },
  field: { gap: 6 },
  label: { fontSize: 15 },
  help: { fontSize: 12, color: '#777', marginLeft: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D7DAE0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  button: { backgroundColor: '#1F5EFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#C0392B', fontSize: 12, marginLeft: 4 },
});
