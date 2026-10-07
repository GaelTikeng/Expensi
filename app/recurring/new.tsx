import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { ensureNotificationPermission } from '@/src/features/notifications/permissions';
import { recurringApi } from '@/src/features/planned/api';
import { RecurringForm } from '@/src/features/planned/RecurringForm';
import { syncReminders } from '@/src/features/planned/reminders';
import { useMe } from '@/src/features/settings/useMe';

/** F6.2: create a fixed charge; materialise and arm this/next month's reminders right away. */
export default function NewRecurringScreen() {
  const { getToken } = useAuth();
  const api = useMemo(() => recurringApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [submitting, setSubmitting] = useState(false);

  if (catLoading || meLoading || !profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <RecurringForm
      categories={categories}
      currencies={currencies}
      defaultCurrency={profile.defaultCurrency}
      submitLabel="Save fixed charge"
      submitting={submitting}
      onSubmit={async (values) => {
        setSubmitting(true);
        try {
          await api.create(values);
          const { created } = await api.materialize();
          const allowed = await ensureNotificationPermission('Get reminded before each fixed charge is due.');
          if (allowed) await syncReminders(created, makeCurrencyLookup(currencies));
          router.back();
        } catch (err) {
          Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
        } finally {
          setSubmitting(false);
        }
      }}
    />
  );
}
