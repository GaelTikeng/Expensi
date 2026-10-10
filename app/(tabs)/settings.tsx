import { useAuth, useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Group, GroupRow } from '@/src/components/group';
import { GroupSkeleton, loadingA11y } from '@/src/components/skeletons';
import { TabScreen } from '@/src/components/tab-screen';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/src/components/ui/alert-dialog';
import { Progress } from '@/src/components/ui/progress';
import { Switch } from '@/src/components/ui/switch';
import { Text } from '@/src/components/ui/text';
import { useRecapReminders } from '@/src/features/notifications/useRecapReminders';
import { OptionPicker } from '@/src/features/settings/OptionPicker';
import { useMe } from '@/src/features/settings/useMe';
import { apiFetch } from '@/src/lib/api';
import { keys, useRefetchOnFocus } from '@/src/lib/query';
import { TIMEZONES } from '@/src/lib/timezones';

interface Usage {
  extract: { used: number; limit: number };
  narrative: { used: number; limit: number };
}

/**
 * F1.4 + F1.6: profile preferences, reminders, AI usage, sign out, delete account.
 */
export default function SettingsScreen() {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const me = useMe();
  const reminders = useRecapReminders();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const usage = useQuery({ queryKey: keys.usage, queryFn: () => apiFetch<Usage>('/api/usage', getToken) }).data ?? null;
  useRefetchOnFocus(keys.usage);

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await me.deleteAccount();
      await signOut();
    } catch (err) {
      setDeleting(false);
      setDeleteError(err instanceof Error ? err.message : String(err));
    }
  };

  if (me.loading && !me.profile) {
    return (
      // Mirrors the groups below: account, preferences, reminders, AI usage, about, session.
      <TabScreen>
        <View className="flex-1 gap-2 p-4" {...loadingA11y}>
          <GroupSkeleton title rows={1} />
          <GroupSkeleton title rows={2} />
          <GroupSkeleton title rows={2} descriptions={[0, 1]} />
          <GroupSkeleton title rows={2} descriptions={[0, 1]} />
          <GroupSkeleton title rows={1} />
          <GroupSkeleton title rows={2} />
        </View>
      </TabScreen>
    );
  }

  const remindersOff = !reminders.prefs || !reminders.supported;

  return (
    <TabScreen>
      <ScrollView className="flex-1" contentContainerClassName="gap-2 p-4 pb-12">
        <Group title="Account">
          <GroupRow label="Email" value={user?.primaryEmailAddress?.emailAddress ?? me.profile?.email ?? '—'} />
        </Group>

        <Group title="Preferences" footer={me.error ? <Text className="text-destructive ml-1 text-[13px]">{me.error}</Text> : undefined}>
          <OptionPicker
            label="Currency"
            value={me.profile?.defaultCurrency ?? 'XAF'}
            options={me.currencies.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
            onChange={(code) => me.update({ defaultCurrency: code })}
            disabled={me.saving}
          />
          <OptionPicker
            label="Timezone"
            value={me.profile?.timezone ?? 'Africa/Douala'}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace('_', ' ') }))}
            onChange={(tz) => me.update({ timezone: tz })}
            disabled={me.saving}
          />
        </Group>

        <Group
          title="Reminders"
          footer={
            reminders.unavailableReason === 'web'
              ? 'Reminders are available in the mobile app.'
              : reminders.unavailableReason === 'expo-go-android'
                ? 'Reminders need the full app build. Expo Go on Android does not include notifications.'
                : undefined
          }
        >
          <GroupRow
            label="Weekly recap"
            description="Every Monday morning"
            disabled={remindersOff}
            right={
              <Switch
                checked={reminders.prefs?.weeklyRecapReminder ?? false}
                onCheckedChange={(v) => void reminders.setWeekly(v)}
                disabled={remindersOff}
              />
            }
          />
          <GroupRow
            label="Monthly recap"
            description="On the 1st of each month"
            disabled={remindersOff}
            right={
              <Switch
                checked={reminders.prefs?.monthlyRecapReminder ?? false}
                onCheckedChange={(v) => void reminders.setMonthly(v)}
                disabled={remindersOff}
              />
            }
          />
        </Group>

        <Group title="AI usage this month">
          <UsageRow label="File imports" used={usage?.extract.used} limit={usage?.extract.limit} />
          <UsageRow label="Recap summaries" used={usage?.narrative.used} limit={usage?.narrative.limit} />
        </Group>

        <Group title="About">
          <GroupRow label="Privacy" onPress={() => router.push('/privacy')} />
        </Group>

        <Group title="Session" footer={deleteError ? <Text className="text-destructive ml-1 text-[13px]">{deleteError}</Text> : undefined}>
          <GroupRow label="Sign out" onPress={() => signOut()} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GroupRow label={deleting ? 'Deleting…' : 'Delete account'} destructive disabled={deleting} onPress={() => undefined} />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your expenses, plans, imports and attachments. It cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Text>Cancel</Text>
                </AlertDialogCancel>
                <AlertDialogAction className="bg-destructive" onPress={() => void deleteAccount()}>
                  <Text className="text-destructive-foreground">Delete</Text>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Group>
      </ScrollView>
    </TabScreen>
  );
}

function UsageRow({ label, used, limit }: { label: string; used?: number; limit?: number }) {
  const pct = used != null && limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <View className="gap-2 px-4 py-3">
      <View className="flex-row justify-between">
        <Text className="text-[15px]">{label}</Text>
        <Text className="text-muted-foreground text-[15px]">{used != null && limit != null ? `${used} / ${limit}` : '…'}</Text>
      </View>
      <Progress value={pct} className="h-1.5" />
    </View>
  );
}
