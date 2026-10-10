import { useAuth } from '@clerk/expo';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, ChartColumn, Clock, Coins, Download, FileText, LogOut, Palette, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useActionSheets } from '@/src/components/action-sheet';
import { Avatar } from '@/src/components/avatar';
import { MenuGroup, MenuRow } from '@/src/components/menu';
import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import { useRecapReminders } from '@/src/features/notifications/useRecapReminders';
import { useMe } from '@/src/features/settings/useMe';
import { APPEARANCE_OPTIONS, useAppearance } from '@/src/lib/appearance';
import { keys, useRefetchOnFocus } from '@/src/lib/query';

/**
 * E17 account hub: a menu. Every row opens its own screen; nothing is edited
 * in place here. Sign out and account deletion both ask first.
 */
export default function AccountScreen() {
  const { signOut } = useAuth();
  const me = useMe();
  const reminders = useRecapReminders();
  const { appearance } = useAppearance();
  const { confirm } = useActionSheets();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useRefetchOnFocus(keys.me);

  const confirmSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You can sign back in at any time with your email or Google.',
      actionLabel: 'Sign out',
    });
    if (ok) await signOut();
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: 'Delete your account?',
      message: 'This permanently removes your expenses, plans, imports and attachments. It cannot be undone.',
      actionLabel: 'Delete my account',
    });
    if (!ok) return;
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

  if (me.loading && !me.profile) return <AccountSkeleton />;

  const p = me.profile;
  const version = Constants.expoConfig?.version ?? '';
  const remindersValue = !reminders.supported
    ? 'Unavailable'
    : [reminders.prefs?.weeklyRecapReminder && 'Weekly', reminders.prefs?.monthlyRecapReminder && 'Monthly'].filter(Boolean).join(', ') || 'Off';

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="p-4 pb-12">
      <View className="flex-row items-center gap-4 pb-2 pt-4">
        <View className="flex-1 gap-1">
          <Text className="text-2xl font-extrabold" numberOfLines={2}>
            {p?.displayName ?? 'Your account'}
          </Text>
          <Text className="text-muted-foreground text-[15px]" numberOfLines={1}>
            {p?.phone ?? p?.email ?? ''}
          </Text>
        </View>
        <Avatar uri={p?.avatarUrl ?? p?.imageUrl} name={p?.displayName ?? p?.email} size={72} />
      </View>

      <MenuGroup title="Account" footer={me.error ? <Text className="text-destructive ml-1 text-[13px]">{me.error}</Text> : undefined}>
        <MenuRow icon={UserRound} label="Personal information" onPress={() => router.push('/account/profile')} />
      </MenuGroup>

      <MenuGroup title="Preferences">
        <MenuRow icon={Coins} label="Currency" value={p?.defaultCurrency} onPress={() => router.push('/account/currency')} />
        <MenuRow icon={Clock} label="Timezone" value={cityOf(p?.timezone)} onPress={() => router.push('/account/timezone')} />
        <MenuRow
          icon={Palette}
          label="Appearance"
          value={APPEARANCE_OPTIONS.find((o) => o.value === appearance)?.label}
          onPress={() => router.push('/account/appearance')}
        />
      </MenuGroup>

      <MenuGroup title="Notifications">
        <MenuRow icon={Bell} label="Reminders" value={remindersValue} onPress={() => router.push('/account/reminders')} />
      </MenuGroup>

      <MenuGroup title="Data">
        <MenuRow icon={Download} label="Export expenses" onPress={() => router.push('/export')} />
        <MenuRow icon={ChartColumn} label="AI usage" onPress={() => router.push('/account/usage')} />
      </MenuGroup>

      <MenuGroup title="Legal">
        <MenuRow icon={FileText} label="Privacy policy" onPress={() => router.push('/privacy')} />
      </MenuGroup>

      <MenuGroup footer={deleteError ? <Text className="text-destructive ml-1 text-[13px]">{deleteError}</Text> : undefined}>
        <MenuRow icon={LogOut} label="Sign out" tone="muted" onPress={() => void confirmSignOut()} disabled={deleting} />
        <MenuRow icon={Trash2} label={deleting ? 'Deleting…' : 'Delete account'} tone="destructive" onPress={() => void confirmDelete()} disabled={deleting} />
      </MenuGroup>

      <Text className="text-muted-foreground mt-6 text-center text-xs">
        xpens-ia{version ? ` · version ${version}` : ''}
      </Text>
    </ScrollView>
  );
}

/** "Africa/Douala" → "Douala". */
function cityOf(tz: string | undefined): string | undefined {
  return tz?.split('/').pop()?.replace(/_/g, ' ');
}

/** Mirrors the header and the menu groups while the profile loads. */
function AccountSkeleton() {
  const group = (rows: number, key: number) => (
    <View key={key} className="gap-2">
      <SkeletonLine className="ml-1 mt-5 h-4 w-28" />
      <View className="bg-card border-border overflow-hidden rounded-xl border">
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} className="min-h-14 flex-row items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-9 rounded-lg" />
            <SkeletonLine className="h-3.5 w-36" />
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <View className="bg-background flex-1 p-4" {...loadingA11y}>
      <View className="flex-row items-center gap-4 pb-2 pt-4">
        <View className="flex-1 gap-2.5">
          <SkeletonLine className="h-6 w-48" />
          <SkeletonLine className="h-3.5 w-36" />
        </View>
        <Skeleton className="size-[72px] rounded-full" />
      </View>
      {[1, 3, 1, 2].map((rows, i) => group(rows, i))}
    </View>
  );
}
