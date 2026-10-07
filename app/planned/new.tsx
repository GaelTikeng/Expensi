import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { ensureNotificationPermission } from '@/src/features/notifications/permissions';
import { plannedApi } from '@/src/features/planned/api';
import { PlannedForm } from '@/src/features/planned/PlannedForm';
import { scheduleFor } from '@/src/features/planned/reminders';
import { useMe } from '@/src/features/settings/useMe';

/** F5.2 + F5.3: create a plan and arm its two reminders. */
export default function NewPlannedScreen() {
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
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
    <PlannedForm
      categories={categories}
      currencies={currencies}
      defaultCurrency={profile.defaultCurrency}
      submitLabel="Save plan"
      submitting={submitting}
      onSubmit={async (values) => {
        setSubmitting(true);
        try {
          const saved = await api.create(values);
          const allowed = await ensureNotificationPermission('Get reminded the day before and one hour before each planned expense.');
          if (allowed) await scheduleFor(saved, makeCurrencyLookup(currencies)(saved.currency));
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
