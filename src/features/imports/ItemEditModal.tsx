import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/src/components/form-field';
import { Group } from '@/src/components/group';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { OptionPicker } from '@/src/features/settings/OptionPicker';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import type { ImportItemDto, ImportItemPatch } from '@/src/lib/schemas/import';
import { useTranslation } from 'react-i18next';

const NONE = '__none__';
const KINDS = ['expense', 'total', 'subtotal', 'header', 'struck_through', 'illegible'] as const;

/** F3.9 inline edit for one staged row. */
export function ItemEditModal({
  item,
  currency,
  categories,
  saving,
  onSave,
  onClose,
}: {
  item: ImportItemDto | null;
  currency: CurrencyInfo;
  categories: CategoryDto[];
  saving: boolean;
  onSave: (patch: ImportItemPatch) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={item !== null} animationType="slide" onRequestClose={onClose}>
      {item ? <Body key={item.id} item={item} currency={currency} categories={categories} saving={saving} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({
  item,
  currency,
  categories,
  saving,
  onSave,
  onClose,
}: {
  item: ImportItemDto;
  currency: CurrencyInfo;
  categories: CategoryDto[];
  saving: boolean;
  onSave: (patch: ImportItemPatch) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [amountMinor, setAmountMinor] = useState<number | null>(item.amountMinor);
  const [occurredOn, setOccurredOn] = useState<string | null>(item.occurredOn);
  const [description, setDescription] = useState(item.description ?? '');
  const [payee, setPayee] = useState(item.payee ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(item.categoryId);
  const [lineKind, setLineKind] = useState(item.lineKind);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="border-border flex-row items-center justify-between border-b px-4 pb-3 pt-2">
        <Button variant="ghost" size="sm" onPress={onClose}>
          <Text className="text-primary text-base">{t('common.cancel')}</Text>
        </Button>
        <Text variant="large" className="text-base">
          {t('imports.row.line', { n: item.lineIndex + 1 })}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          onPress={() =>
            onSave({
              amountMinor,
              occurredOn,
              description: description.trim() || null,
              payee: payee.trim() || null,
              categoryId,
              lineKind: lineKind as ImportItemPatch['lineKind'],
            })
          }
          disabled={saving}
        >
          <Text className="text-primary text-base font-semibold">{saving ? t('common.saving') : t('common.save')}</Text>
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-12" keyboardShouldPersistTaps="handled">
        <View className="bg-warning/10 gap-1 rounded-lg p-3">
          <Text className="text-warning text-[11px] font-medium uppercase tracking-wide">{t('imports.edit.asWritten')}</Text>
          <Text className="font-mono text-sm">{item.rawText}</Text>
          {item.ambiguityNote ? <Text className="text-warning text-xs italic">{item.ambiguityNote}</Text> : null}
        </View>

        <AmountInput value={amountMinor} currency={currency} onChange={setAmountMinor} />

        <Group>
          <View className="px-4 py-3">
            <DateField label={t('expenseForm.date')} value={occurredOn} onChange={setOccurredOn} nullable />
          </View>
        </Group>

        <FormField label={t('expenseForm.description')}>
          <Input value={description} onChangeText={setDescription} placeholder={t('expenseForm.descriptionPlaceholder')} />
        </FormField>

        <FormField label={t('expenseForm.paidTo')}>
          <Input value={payee} onChangeText={setPayee} placeholder={t('common.optional')} />
        </FormField>

        <Group>
          <OptionPicker
            label={t('expenseForm.category')}
            value={categoryId ?? NONE}
            options={[{ value: NONE, label: t('common.none') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={(v) => setCategoryId(v === NONE ? null : v)}
          />
          <OptionPicker label={t('imports.edit.lineType')} value={lineKind} options={KINDS.map((k) => ({ value: k, label: t(`imports.kinds.${k}`) }))} onChange={(v) => setLineKind(v as typeof lineKind)} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}
