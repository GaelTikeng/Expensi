import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { FormField } from '@/src/components/form-field';
import { Group } from '@/src/components/group';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { Textarea } from '@/src/components/ui/textarea';
import { useThemeColors } from '@/src/lib/theme';

import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { newId } from '@/src/features/expenses/ids';
import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { addDays, toISODate, todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import { plannedInputSchema, type PlannedDto, type PlannedInput } from '@/src/lib/schemas/planned';
import { TimeField } from './TimeField';
import { notificationsUnavailableReason } from '@/src/features/notifications/module';
import { useTranslation } from 'react-i18next';
import { fieldErrors } from '@/src/i18n/validation';

const NONE = '__none__';

// Expo Go on Android ships without notifications and web has no local
// scheduling; say so where the user expects a reminder.
const REMINDER_FOOTER =
  notificationsUnavailableReason === 'expo-go-android'
    ? 'plannedForm.footerExpoGo'
    : notificationsUnavailableReason === 'web'
      ? 'plannedForm.footerWeb'
      : 'plannedForm.footer';
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
  currencies: readonly CurrencyInfo[];
  defaultCurrency: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: PlannedInput) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const theme = useThemeColors();
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
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <FormField label={t('plannedForm.what')} error={errors.title}>
        <Input value={title} onChangeText={setTitle} placeholder={t('plannedForm.whatPlaceholder')} autoFocus={!initial} />
      </FormField>

      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} error={errors.amountMinor} />
      <Group>
        <OptionPicker label={t('plannedForm.currency')} value={currency} options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))} onChange={setCurrency} />
      </Group>

      <Group footer={t(REMINDER_FOOTER)}>
        <View className="px-4 py-3">
          <DateField label={t('plannedForm.when')} value={date} onChange={(d) => d && setDate(d)} />
        </View>
        <View className="px-4 py-3">
          <TimeField label={t('plannedForm.at')} value={time} onChange={setTime} />
        </View>
      </Group>

      <FormField label={t('plannedForm.where')} error={errors.place}>
        <Input value={place} onChangeText={setPlace} placeholder={t('common.optional')} />
      </FormField>
      <FormField label={t('plannedForm.toWhom')} error={errors.payee}>
        <Input value={payee} onChangeText={setPayee} placeholder={t('common.optional')} />
      </FormField>
      <FormField label={t('plannedForm.why')} error={errors.reason}>
        <Textarea value={reason} onChangeText={setReason} placeholder={t('common.optional')} />
      </FormField>

      <Group>
        <OptionPicker
          label={t('plannedForm.category')}
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: t('common.none') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
      </Group>

      <FormField label={t('plannedForm.notes')} error={errors.notes}>
        <Textarea value={notes} onChangeText={setNotes} placeholder={t('common.optional')} />
      </FormField>

      <Button size="lg" className="mt-2" disabled={submitting} onPress={submit}>
        {submitting ? <ActivityIndicator color={theme.primaryForeground} /> : <Text>{submitLabel}</Text>}
      </Button>
    </ScrollView>
  );
}
