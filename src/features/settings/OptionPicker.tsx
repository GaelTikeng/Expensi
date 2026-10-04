import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface Option {
  value: string;
  label: string;
}

/**
 * A row that opens a full-screen list. Dependency-free on purpose; swap for a
 * bottom sheet when a UI kit is chosen.
 */
export function OptionPicker({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <Pressable style={styles.row} onPress={() => setOpen(true)} disabled={disabled}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {current} ›
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.item}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.itemText, item.value === value && styles.itemSelected]}>
                  {item.label}
                </Text>
                {item.value === value ? <Text style={styles.itemSelected}>✓</Text> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, gap: 12 },
  label: { fontSize: 15 },
  value: { fontSize: 15, color: '#666', flexShrink: 1 },
  modal: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F3',
  },
  title: { fontSize: 18, fontWeight: '600' },
  close: { fontSize: 16, color: '#1F5EFF' },
  separator: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 16 },
  item: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  itemText: { fontSize: 16 },
  itemSelected: { color: '#1F5EFF', fontWeight: '600' },
});
