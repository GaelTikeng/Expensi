import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Group, GroupRow } from '@/src/components/group';
import { Switch } from '@/src/components/ui/switch';
import { useRecapReminders } from '@/src/features/notifications/useRecapReminders';

/** E17 / F4.6: opt-in recap reminders on this phone. Planned-expense reminders are always on. */
export default function RemindersScreen() {
  const { t } = useTranslation();
  const reminders = useRecapReminders();
  const off = !reminders.prefs || !reminders.supported;
  const footer =
    reminders.unavailableReason === 'web'
      ? t('reminders.footerWeb')
      : reminders.unavailableReason === 'expo-go-android'
        ? t('reminders.footerExpoGo')
        : t('reminders.footerDefault');
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-2 p-4 pb-12">
      <Group title={t('reminders.group')} footer={footer}>
        <GroupRow
          label={t('reminders.weekly')}
          description={t('reminders.weeklyDescription')}
          disabled={off}
          right={<Switch checked={reminders.prefs?.weeklyRecapReminder ?? false} onCheckedChange={(v) => void reminders.setWeekly(v)} disabled={off} />}
        />
        <GroupRow
          label={t('reminders.monthly')}
          description={t('reminders.monthlyDescription')}
          disabled={off}
          right={<Switch checked={reminders.prefs?.monthlyRecapReminder ?? false} onCheckedChange={(v) => void reminders.setMonthly(v)} disabled={off} />}
        />
      </Group>
    </ScrollView>
  );
}
