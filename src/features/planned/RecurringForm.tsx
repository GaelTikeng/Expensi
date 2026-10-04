import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { newId } from '@/src/features/expenses/ids';
import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { startOfMonth, todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import { recurringInputSchema, type RecurringDto, type RecurringInput } from '@/src/lib/schemas/recurring';
import { TimeField } from './TimeField';

const NONE = '__none__';
const DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }));

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]} of the month`;
}

/** F6.2: a fixed monthly charge. */
export function RecurringForm({
  initial,
  categories,
  currencies,
  defaultCurrency,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: RecurringDto;
  categories: CategoryDto[];
  currencies: CurrencyInfo[];
  defaultCurrency: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: RecurringInput) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amountMinor, setAmountMinor] = useState<number | null>(initial?.amountMinor ?? null);
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth ?? 1);
  const [reminderTime, setReminderTime] = useState(initial?.reminderTime ?? '09:00');
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? startOfMonth(todayISO()));
  const [hasEnd, setHasEnd] = useState(Boolean(initial?.endsOn));
  const [endsOn, setEndsOn] = useState<string | null>(initial?.endsOn ?? null);
  const [payee, setPayee] = useState(initial?.payee ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currencyInfo = useMemo<CurrencyInfo>(
    () => currencies.find((c) => c.code === currency) ?? { code: currency, exponent: 0, symbol: currency },
    [currencies, currency],
  );

  const submit = async () => {
    const parsed = recurringInputSchema.safeParse({
      id: initial?.id ?? newId(),
      name,
      amountMinor: amountMinor ?? 0,
      currency,
      categoryId,
      payee: payee.trim() || null,
      notes: notes.trim() || null,
      dayOfMonth,
      reminderTime,
      startsOn,
      endsOn: hasEnd ? endsOn : null,
      isActive,
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
      <Field label="Name" error={errors.name}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Rent, Internet, School bus" autoFocus={!initial} />
      </Field>

      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} error={errors.amountMinor} />
      <View style={styles.card}>
        <OptionPicker label="Currency" value={currency} options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))} onChange={setCurrency} />
        <OptionPicker label="Due" value={String(dayOfMonth)} options={DAYS} onChange={(v) => setDayOfMonth(Number(v))} />
        <View style={styles.inner}>
          <TimeField label="Reminder at" value={reminderTime} onChange={setReminderTime} />
        </View>
      </View>
      <Text style={styles.help}>Each month a planned expense is created for this charge, with reminders the day before and one hour before.</Text>

      <View style={styles.card}>
        <DateField label="Starts" value={startsOn} onChange={(d) => d && setStartsOn(d)} />
        <View style={styles.separator} />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Has an end date</Text>
          <Switch value={hasEnd} onValueChange={setHasEnd} />
        </View>
        {hasEnd ? <DateField label="Ends" value={endsOn} onChange={setEndsOn} nullable /> : null}
      </View>

      <View style={styles.card}>
        <OptionPicker
          label="Category"
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: 'None' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
      </View>

      <Field label="Paid to" error={errors.payee}>
        <TextInput style={styles.input} value={payee} onChangeText={setPayee} placeholder="Optional" />
      </Field>
      <Field label="Notes" error={errors.notes}>
        <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
      </Field>

      {initial ? (
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Active</Text>
              <Text style={styles.help}>Inactive charges stop creating planned expenses.</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
        </View>
      ) : null}

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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 4, gap: 4 },
  inner: { paddingHorizontal: 10, paddingVertical: 6 },
  separator: { height: 1, backgroundColor: '#EEF0F3', marginHorizontal: 10 },
  field: { gap: 6 },
  label: { fontSize: 15 },
  help: { fontSize: 12, color: '#777', marginLeft: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D7DAE0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, gap: 12 },
  button: { backgroundColor: '#1F5EFF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#C0392B', fontSize: 12, marginLeft: 4 },
});
