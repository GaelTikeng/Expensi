import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';

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
    <View className="min-h-9 flex-row items-center justify-between">
      <Text className="text-[15px]">{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker mode="time" display="compact" value={asDate} onChange={handle} />
      ) : (
        <>
          <Button variant="secondary" size="sm" onPress={() => setShow(true)}>
            <Text>{value}</Text>
          </Button>
          {show ? <DateTimePicker mode="time" display="default" is24Hour value={asDate} onChange={handle} /> : null}
        </>
      )}
    </View>
  );
}
