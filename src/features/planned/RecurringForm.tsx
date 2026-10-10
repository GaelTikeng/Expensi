import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { FormField } from '@/src/components/form-field';
import { Group, GroupRow } from '@/src/components/group';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Switch } from '@/src/components/ui/switch';
import { Text } from '@/src/components/ui/text';
import { Textarea } from '@/src/components/ui/textarea';
import { useThemeColors } from '@/src/lib/theme';

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
  currencies: readonly CurrencyInfo[];
  defaultCurrency: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: RecurringInput) => Promise<void> | void;
}) {
  const theme = useThemeColors();
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
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <FormField label="Name" error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder="e.g. Rent, Internet, School bus" autoFocus={!initial} />
      </FormField>

      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} error={errors.amountMinor} />
      <Group footer="Each month a planned expense is created for this charge, with reminders the day before and at the time.">
        <OptionPicker label="Currency" value={currency} options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))} onChange={setCurrency} />
        <OptionPicker label="Due" value={String(dayOfMonth)} options={DAYS} onChange={(v) => setDayOfMonth(Number(v))} />
        <View className="px-4 py-3">
          <TimeField label="Reminder at" value={reminderTime} onChange={setReminderTime} />
        </View>
      </Group>

      <Group>
        <View className="px-4 py-3">
          <DateField label="Starts" value={startsOn} onChange={(d) => d && setStartsOn(d)} />
        </View>
        <GroupRow label="Has an end date" right={<Switch checked={hasEnd} onCheckedChange={setHasEnd} />} />
        {hasEnd ? (
          <View className="px-4 py-3">
            <DateField label="Ends" value={endsOn} onChange={setEndsOn} nullable />
          </View>
        ) : null}
      </Group>

      <Group>
        <OptionPicker
          label="Category"
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: 'None' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
      </Group>

      <FormField label="Paid to" error={errors.payee}>
        <Input value={payee} onChangeText={setPayee} placeholder="Optional" />
      </FormField>
      <FormField label="Notes" error={errors.notes}>
        <Textarea value={notes} onChangeText={setNotes} placeholder="Optional" />
      </FormField>

      {initial ? (
        <Group>
          <GroupRow
            label="Active"
            description="Inactive charges stop creating planned expenses."
            right={<Switch checked={isActive} onCheckedChange={setIsActive} />}
          />
        </Group>
      ) : null}

      <Button size="lg" className="mt-2" disabled={submitting} onPress={submit}>
        {submitting ? <ActivityIndicator color={theme.primaryForeground} /> : <Text>{submitLabel}</Text>}
      </Button>
    </ScrollView>
  );
}
