import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, parseISODate, relativeDayLabel, toISODate, todayISO, type ISODate } from '@/src/lib/dates';

/**
 * Calendar-date picker with Today / Yesterday shortcuts. iOS renders the
 * compact inline control; Android opens the system dialog on tap.
 */
export function DateField({
  label,
  value,
  onChange,
  nullable,
}: {
  label: string;
  value: ISODate | null;
  onChange: (iso: ISODate | null) => void;
  /** When true, a "Clear" chip is offered. */
  nullable?: boolean;
}) {
  const [showAndroid, setShowAndroid] = useState(false);
  const today = todayISO();

  const handlePicker = (event: DateTimePickerEvent, date?: Date) => {
    setShowAndroid(false);
    if (event.type === 'dismissed' || !date) return;
    onChange(toISODate(date));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            mode="date"
            display="compact"
            value={parseISODate(value ?? today)}
            onChange={handlePicker}
            maximumDate={parseISODate(addDays(today, 366))}
          />
        ) : (
          <Pressable style={styles.valueButton} onPress={() => setShowAndroid(true)}>
            <Text style={styles.valueText}>{value ? relativeDayLabel(value) : 'Pick a date'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.chips}>
        <Chip label="Today" active={value === today} onPress={() => onChange(today)} />
        <Chip label="Yesterday" active={value === addDays(today, -1)} onPress={() => onChange(addDays(today, -1))} />
        {nullable ? <Chip label="Clear" active={value === null} onPress={() => onChange(null)} /> : null}
      </View>

      {showAndroid && Platform.OS === 'android' ? (
        <DateTimePicker mode="date" display="default" value={parseISODate(value ?? today)} onChange={handlePicker} />
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  label: { fontSize: 15 },
  valueButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#EEF0F3', borderRadius: 8 },
  valueText: { fontSize: 15 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#D7DAE0' },
  chipActive: { backgroundColor: '#1F5EFF', borderColor: '#1F5EFF' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
});
