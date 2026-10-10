import { ScrollView } from 'react-native';

import { Group, GroupRow } from '@/src/components/group';
import { Switch } from '@/src/components/ui/switch';
import { useRecapReminders } from '@/src/features/notifications/useRecapReminders';

/** E17 / F4.6: opt-in recap reminders on this phone. Planned-expense reminders are always on. */
export default function RemindersScreen() {
  const reminders = useRecapReminders();
  const off = !reminders.prefs || !reminders.supported;
  const footer =
    reminders.unavailableReason === 'web'
      ? 'Reminders are available in the mobile app.'
      : reminders.unavailableReason === 'expo-go-android'
        ? 'Reminders need the full app build. Expo Go on Android does not include notifications.'
        : 'Planned expenses always remind you the day before and at the set time.';
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-2 p-4 pb-12">
      <Group title="Recaps" footer={footer}>
        <GroupRow
          label="Weekly recap"
          description="Every Monday morning"
          disabled={off}
          right={<Switch checked={reminders.prefs?.weeklyRecapReminder ?? false} onCheckedChange={(v) => void reminders.setWeekly(v)} disabled={off} />}
        />
        <GroupRow
          label="Monthly recap"
          description="On the 1st of each month"
          disabled={off}
          right={<Switch checked={reminders.prefs?.monthlyRecapReminder ?? false} onCheckedChange={(v) => void reminders.setMonthly(v)} disabled={off} />}
        />
      </Group>
    </ScrollView>
  );
}
