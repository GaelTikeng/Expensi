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
import { useTranslation } from 'react-i18next';
import { fieldErrors } from '@/src/i18n/validation';

const NONE = '__none__';
const DAY_NUMBERS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "1st" / "1er" / "1." — ordinals differ too much for a plural rule. */
function ordinal(n: number, lang: string) {
  if (lang === 'fr') return n === 1 ? '1er' : String(n);
  if (lang === 'de') return `${n}.`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
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
  const { t, i18n } = useTranslation();
  const theme = useThemeColors();
  const days = useMemo(
    () => DAY_NUMBERS.map((n) => ({ value: String(n), label: t('recurringForm.dueDay', { day: ordinal(n, i18n.language) }) })),
    [t, i18n.language],
  );
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
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-12" keyboardShouldPersistTaps="handled">
      <FormField label={t('recurringForm.name')} error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder={t('recurringForm.namePlaceholder')} autoFocus={!initial} />
      </FormField>

      <AmountInput value={amountMinor} currency={currencyInfo} onChange={setAmountMinor} error={errors.amountMinor} />
      <Group footer={t('recurringForm.footer')}>
        <OptionPicker label={t('recurringForm.currency')} value={currency} options={currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.symbol}` }))} onChange={setCurrency} />
        <OptionPicker label={t('recurringForm.due')} value={String(dayOfMonth)} options={days} onChange={(v) => setDayOfMonth(Number(v))} />
        <View className="px-4 py-3">
          <TimeField label={t('recurringForm.reminderAt')} value={reminderTime} onChange={setReminderTime} />
        </View>
      </Group>

      <Group>
        <View className="px-4 py-3">
          <DateField label={t('recurringForm.starts')} value={startsOn} onChange={(d) => d && setStartsOn(d)} />
        </View>
        <GroupRow label={t('recurringForm.hasEnd')} right={<Switch checked={hasEnd} onCheckedChange={setHasEnd} />} />
        {hasEnd ? (
          <View className="px-4 py-3">
            <DateField label={t('recurringForm.ends')} value={endsOn} onChange={setEndsOn} nullable />
          </View>
        ) : null}
      </Group>

      <Group>
        <OptionPicker
          label={t('recurringForm.category')}
          value={categoryId ?? NONE}
          options={[{ value: NONE, label: t('common.none') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(v) => setCategoryId(v === NONE ? null : v)}
        />
      </Group>

      <FormField label={t('recurringForm.paidTo')} error={errors.payee}>
        <Input value={payee} onChangeText={setPayee} placeholder={t('common.optional')} />
      </FormField>
      <FormField label={t('recurringForm.notes')} error={errors.notes}>
        <Textarea value={notes} onChangeText={setNotes} placeholder={t('common.optional')} />
      </FormField>

      {initial ? (
        <Group>
          <GroupRow
            label={t('recurringForm.active')}
            description={t('recurringForm.activeDescription')}
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
