import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:MM" time-of-day picker; iOS inline compact, Android dialog. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const [show, setShow] = useState(false);
  const [h, m] = value.split(':').map(Number);
  const asDate = new Date(2000, 0, 1, h || 0, m || 0);

  const handle = (e: DateTimePickerEvent, d?: Date) => {
    setShow(false);
    if (e.type === 'dismissed' || !d) return;
    onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker mode="time" display="compact" value={asDate} onChange={handle} />
      ) : (
        <>
          <Pressable style={styles.button} onPress={() => setShow(true)}>
            <Text style={styles.value}>{value}</Text>
          </Pressable>
          {show ? <DateTimePicker mode="time" display="default" is24Hour value={asDate} onChange={handle} /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  label: { fontSize: 15 },
  button: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#EEF0F3', borderRadius: 8 },
  value: { fontSize: 15 },
});
