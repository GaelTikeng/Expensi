import { useAuth } from '@clerk/expo';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, ChartColumn, Clock, Coins, Download, FileText, Languages, LogOut, Palette, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useActionSheets } from '@/src/components/action-sheet';
import { Avatar } from '@/src/components/avatar';
import { MenuGroup, MenuRow } from '@/src/components/menu';
import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import { useRecapReminders } from '@/src/features/notifications/useRecapReminders';
import { useMe } from '@/src/features/settings/useMe';
import { LANGUAGE_NAMES } from '@/src/i18n';
import { useLanguagePref } from '@/src/i18n/language';
import { useAppearance } from '@/src/lib/appearance';
import { keys, useRefetchOnFocus } from '@/src/lib/query';

/**
 * E17 account hub: a menu. Every row opens its own screen; nothing is edited
 * in place here. Sign out and account deletion both ask first.
 */
export default function AccountScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const me = useMe();
  const languagePref = useLanguagePref();
  const reminders = useRecapReminders();
  const { appearance } = useAppearance();
  const { confirm } = useActionSheets();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useRefetchOnFocus(keys.me);

  const confirmSignOut = async () => {
    const ok = await confirm({
      title: t('account.signOutConfirm.title'),
      message: t('account.signOutConfirm.message'),
      actionLabel: t('account.signOutConfirm.action'),
    });
    if (ok) await signOut();
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: t('account.deleteConfirm.title'),
      message: t('account.deleteConfirm.message'),
      actionLabel: t('account.deleteConfirm.action'),
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
    ? t('account.remindersValue.unavailable')
    : [reminders.prefs?.weeklyRecapReminder && t('account.remindersValue.weekly'), reminders.prefs?.monthlyRecapReminder && t('account.remindersValue.monthly')]
        .filter(Boolean)
        .join(', ') || t('account.remindersValue.off');

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="p-4 pb-12">
      <View className="flex-row items-center gap-4 pb-2 pt-4">
        <View className="flex-1 gap-1">
          <Text className="text-2xl font-extrabold" numberOfLines={2}>
            {p?.displayName ?? t('account.yourAccount')}
          </Text>
          <Text className="text-muted-foreground text-[15px]" numberOfLines={1}>
            {p?.phone ?? p?.email ?? ''}
          </Text>
        </View>
        <Avatar uri={p?.avatarUrl ?? p?.imageUrl} name={p?.displayName ?? p?.email} size={72} />
      </View>

      <MenuGroup title={t('account.groups.account')} footer={me.error ? <Text className="text-destructive ml-1 text-[13px]">{me.error}</Text> : undefined}>
        <MenuRow icon={UserRound} label={t('account.rows.personalInfo')} onPress={() => router.push('/account/profile')} />
      </MenuGroup>

      <MenuGroup title={t('account.groups.preferences')}>
        <MenuRow icon={Coins} label={t('account.rows.currency')} value={p?.defaultCurrency} onPress={() => router.push('/account/currency')} />
        <MenuRow icon={Clock} label={t('account.rows.timezone')} value={cityOf(p?.timezone)} onPress={() => router.push('/account/timezone')} />
        <MenuRow icon={Palette} label={t('account.rows.appearance')} value={t(`appearance.${appearance}`)} onPress={() => router.push('/account/appearance')} />
        <MenuRow
          icon={Languages}
          label={t('account.rows.language')}
          value={languagePref === 'system' ? t('language.system') : LANGUAGE_NAMES[languagePref]}
          onPress={() => router.push('/account/language')}
        />
      </MenuGroup>

      <MenuGroup title={t('account.groups.notifications')}>
        <MenuRow icon={Bell} label={t('account.rows.reminders')} value={remindersValue} onPress={() => router.push('/account/reminders')} />
      </MenuGroup>

      <MenuGroup title={t('account.groups.data')}>
        <MenuRow icon={Download} label={t('account.rows.export')} onPress={() => router.push('/export')} />
        <MenuRow icon={ChartColumn} label={t('account.rows.aiUsage')} onPress={() => router.push('/account/usage')} />
      </MenuGroup>

      <MenuGroup title={t('account.groups.legal')}>
        <MenuRow icon={FileText} label={t('account.rows.privacy')} onPress={() => router.push('/privacy')} />
      </MenuGroup>

      <MenuGroup footer={deleteError ? <Text className="text-destructive ml-1 text-[13px]">{deleteError}</Text> : undefined}>
        <MenuRow icon={LogOut} label={t('account.rows.signOut')} tone="muted" onPress={() => void confirmSignOut()} disabled={deleting} />
        <MenuRow icon={Trash2} label={deleting ? t('account.deleting') : t('account.rows.deleteAccount')} tone="destructive" onPress={() => void confirmDelete()} disabled={deleting} />
      </MenuGroup>

      <Text className="text-muted-foreground mt-6 text-center text-xs">
        xpens-ia{version ? ` · ${t('account.version', { version })}` : ''}
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
