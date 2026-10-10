import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { FORM_LAYOUTS, FormSkeleton } from '@/src/components/skeletons';
import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { ensureNotificationPermission } from '@/src/features/notifications/permissions';
import { plannedApi } from '@/src/features/planned/api';
import { PlannedForm } from '@/src/features/planned/PlannedForm';
import { scheduleFor } from '@/src/features/planned/reminders';
import { useMe } from '@/src/features/settings/useMe';
import { invalidate } from '@/src/lib/query';

/** F5.2 + F5.3: create a plan and arm its two reminders. */
export default function NewPlannedScreen() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [submitting, setSubmitting] = useState(false);

  if (catLoading || meLoading || !profile) {
    return <FormSkeleton blocks={FORM_LAYOUTS.planned} />;
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
          void invalidate.plans(qc);
          const allowed = await ensureNotificationPermission('Get reminded the day before and at the time of each planned expense.');
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
