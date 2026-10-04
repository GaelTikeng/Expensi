import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountInput } from '@/src/features/expenses/AmountInput';
import { DateField } from '@/src/features/expenses/DateField';
import { OptionPicker } from '@/src/features/settings/OptionPicker';
import type { CurrencyInfo } from '@/src/lib/money';
import type { CategoryDto } from '@/src/lib/schemas/category';
import type { ImportItemDto, ImportItemPatch } from '@/src/lib/schemas/import';

const NONE = '__none__';
const KINDS = [
  { value: 'expense', label: 'Expense' },
  { value: 'total', label: 'Total (not an expense)' },
  { value: 'subtotal', label: 'Subtotal' },
  { value: 'header', label: 'Header / not an expense' },
  { value: 'struck_through', label: 'Crossed out' },
  { value: 'illegible', label: 'Illegible' },
];

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
  const [amountMinor, setAmountMinor] = useState<number | null>(item.amountMinor);
  const [occurredOn, setOccurredOn] = useState<string | null>(item.occurredOn);
  const [description, setDescription] = useState(item.description ?? '');
  const [payee, setPayee] = useState(item.payee ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(item.categoryId);
  const [lineKind, setLineKind] = useState(item.lineKind);

  return (
    <View style={styles.modal}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.headerAction}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Line {item.lineIndex + 1}</Text>
        <Pressable
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
          hitSlop={12}
        >
          <Text style={[styles.headerAction, styles.save]}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.raw}>
          <Text style={styles.rawLabel}>As written</Text>
          <Text style={styles.rawText}>{item.rawText}</Text>
          {item.ambiguityNote ? <Text style={styles.note}>{item.ambiguityNote}</Text> : null}
        </View>

        <AmountInput value={amountMinor} currency={currency} onChange={setAmountMinor} />

        <View style={styles.card}>
          <DateField label="Date" value={occurredOn} onChange={setOccurredOn} nullable />
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="What was it for?" />

        <Text style={styles.label}>Paid to</Text>
        <TextInput style={styles.input} value={payee} onChangeText={setPayee} placeholder="Optional" />

        <View style={styles.card}>
          <OptionPicker
            label="Category"
            value={categoryId ?? NONE}
            options={[{ value: NONE, label: 'None' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={(v) => setCategoryId(v === NONE ? null : v)}
          />
          <OptionPicker label="Line type" value={lineKind} options={KINDS} onChange={(v) => setLineKind(v as typeof lineKind)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#F6F7F9', paddingTop: 56 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E6EB',
    backgroundColor: '#fff',
  },
  headerAction: { fontSize: 16, color: '#1F5EFF' },
  save: { fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600' },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  raw: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, gap: 4 },
  rawLabel: { fontSize: 11, color: '#8A6D1F', textTransform: 'uppercase' },
  rawText: { fontSize: 14, fontFamily: 'Menlo' },
  note: { fontSize: 12, color: '#8A6D1F', fontStyle: 'italic' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 4 },
  label: { fontSize: 15 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D7DAE0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
