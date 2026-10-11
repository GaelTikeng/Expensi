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

import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { todayISO } from '@/src/lib/dates';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import { expenseInputSchema, type ExpenseInput } from '@/src/lib/schemas/expense';
import { AmountInput } from './AmountInput';
import { DateField } from './DateField';
import { LocationField } from '@/src/features/location/LocationField';
import type { ExpensePlace } from '@/src/features/location/capture';
import { newId } from './ids';
import { useTranslation } from 'react-i18next';
import { fieldErrors } from '@/src/i18n/validation';

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
  currencies: readonly CurrencyInfo[];
  defaultCurrency: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: ExpenseInput) => Promise<void> | void;
  /** Rendered between the last field and the submit button (e.g. proof picker). */
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useThemeColors();
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
  const [place, setPlace] = useState<ExpensePlace | null>(
    initial?.latitude != null && initial?.longitude != null
      ? { latitude: initial.latitude, longitude: initial.longitude, locationLabel: initial.locationLabel ?? null }
      : null,
  );
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
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      locationLabel: place?.locationLabel ?? null,
    };
    const parsed = expenseInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} autoFocus={!initial?.id} error={errors.amountMinor} />

      <Group>
        <OptionPicker
          label={t('expenseForm.currency')}
          value={currency}
          options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))}
          onChange={setCurrency}
        />
      </Group>

      <FormField label={t('expenseForm.description')} error={errors.description}>
        <Input value={description} onChangeText={setDescription} placeholder={t('expenseForm.descriptionPlaceholder')} />
      </FormField>

      <FormField label={t('expenseForm.paidTo')} error={errors.payee}>
        <Input value={payee} onChangeText={setPayee} placeholder={t('expenseForm.paidToPlaceholder')} />
      </FormField>

      <Group footer={errors.occurredOn}>
        <OptionPicker
          label={t('expenseForm.category')}
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: t('common.none') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
        <View className="px-4 py-3">
          <DateField label={t('expenseForm.date')} value={occurredOn} onChange={(d) => d && setOccurredOn(d)} />
        </View>
      </Group>

      <Group>
        <GroupRow label={t('expenseForm.paidOnDifferentDay')} right={<Switch checked={showPaidOn} onCheckedChange={setShowPaidOn} />} />
        {showPaidOn ? (
          <View className="px-4 py-3">
            <DateField label={t('expenseForm.paidOn')} value={paidOn} onChange={setPaidOn} nullable />
          </View>
        ) : null}
        <GroupRow
          label={t('expenseForm.estimated')}
          description={t('expenseForm.estimatedDescription')}
          right={<Switch checked={isEstimated} onCheckedChange={setIsEstimated} />}
        />
        <LocationField value={place} onChange={setPlace} isNew={!initial?.id} />
      </Group>

      <FormField label={t('expenseForm.notes')} error={errors.notes}>
        <Textarea value={notes} onChangeText={setNotes} placeholder={t('common.optional')} />
      </FormField>

      {extra}

      <Button size="lg" className="mt-2" disabled={submitting} onPress={submit}>
        {submitting ? <ActivityIndicator color={theme.primaryForeground} /> : <Text>{submitLabel}</Text>}
      </Button>
    </ScrollView>
  );
}
