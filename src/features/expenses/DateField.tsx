import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/src/components/ui/button';
import { Text } from '@/src/components/ui/text';
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
  const yesterday = addDays(today, -1);

  // onChange is deprecated in datetimepicker 9: picks arrive via onValueChange,
  // cancellation via onDismiss.
  const handlePick = (_event: unknown, date: Date) => {
    setShowAndroid(false);
    onChange(toISODate(date));
  };
  const handleDismiss = () => setShowAndroid(false);

  return (
    <View className="gap-2">
      <View className="min-h-9 flex-row items-center justify-between">
        <Text className="text-[15px]">{label}</Text>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            mode="date"
            display="compact"
            value={parseISODate(value ?? today)}
            onValueChange={handlePick}
            onDismiss={handleDismiss}
            maximumDate={parseISODate(addDays(today, 366))}
          />
        ) : (
          <Button variant="secondary" size="sm" onPress={() => setShowAndroid(true)}>
            <Text>{value ? relativeDayLabel(value) : 'Pick a date'}</Text>
          </Button>
        )}
      </View>

      <View className="flex-row gap-2">
        <Chip label="Today" active={value === today} onPress={() => onChange(today)} />
        <Chip label="Yesterday" active={value === yesterday} onPress={() => onChange(yesterday)} />
        {nullable ? <Chip label="Clear" active={value === null} onPress={() => onChange(null)} /> : null}
      </View>

      {showAndroid && Platform.OS === 'android' ? (
        <DateTimePicker mode="date" display="default" value={parseISODate(value ?? today)} onValueChange={handlePick} onDismiss={handleDismiss} />
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-8 rounded-full px-3"
      onPress={onPress}
      accessibilityState={{ selected: active }}
    >
      <Text className="text-[13px]">{label}</Text>
    </Button>
  );
}
