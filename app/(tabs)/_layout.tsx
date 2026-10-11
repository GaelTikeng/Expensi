import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { Calendar, ChartColumn, House, Receipt } from 'lucide-react-native';

import { Icon } from '@/src/components/ui/icon';
import { categoriesApi } from '@/src/features/expenses/api';
import { useUploadQueueFlush } from '@/src/features/attachments/useUploadQueueFlush';
import { useNotificationSetup } from '@/src/features/notifications/useNotificationSetup';
import { apiFetch } from '@/src/lib/api';
import { keys, REFERENCE_STALE } from '@/src/lib/query';
import { useThemeColors } from '@/src/lib/theme';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { applyLanguage, useLanguagePref } from '@/src/i18n/language';
import { useMe } from '@/src/features/settings/useMe';

/**
 * Signed-in shell. Tabs render without a navigation header; each screen
 * starts under the status bar via TabScreen (src/components/tab-screen.tsx).
 */
export default function TabsLayout() {
  const theme = useThemeColors();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { profile } = useMe();
  const pref = useLanguagePref();
  useUploadQueueFlush();
  useNotificationSetup();

  // E14: the account's language wins over this device's copy once loaded.
  const accountPref = profile ? (profile.language ?? 'system') : null;
  useEffect(() => {
    if (accountPref && accountPref !== pref) void applyLanguage(accountPref);
    // Only react to the account value; local changes already applied it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountPref]);

  // Warm the reference data every form needs, so the first "Add expense" of
  // a session opens without waiting (D15).
  useEffect(() => {
    void qc.prefetchQuery({ queryKey: keys.me, queryFn: () => apiFetch('/api/me', getToken), staleTime: REFERENCE_STALE });
    void qc.prefetchQuery({ queryKey: keys.categories, queryFn: () => categoriesApi(getToken).list(), staleTime: REFERENCE_STALE });
  }, [qc, getToken]);
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.primary, tabBarInactiveTintColor: theme.mutedForeground }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Icon as={House} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t('tabs.expenses'),
          tabBarIcon: ({ color, size }) => <Icon as={Receipt} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: t('tabs.plan'),
          tabBarIcon: ({ color, size }) => <Icon as={Calendar} color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="recaps"
        options={{
          title: t('tabs.recaps'),
          tabBarIcon: ({ color, size }) => <Icon as={ChartColumn} color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
