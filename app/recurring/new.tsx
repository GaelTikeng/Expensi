import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { FORM_LAYOUTS, FormSkeleton } from '@/src/components/skeletons';
import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { ensureNotificationPermission } from '@/src/features/notifications/permissions';
import { recurringApi } from '@/src/features/planned/api';
import { RecurringForm } from '@/src/features/planned/RecurringForm';
import { syncReminders } from '@/src/features/planned/reminders';
import { markMaterializationStale } from '@/src/features/planned/usePlanned';
import { useMe } from '@/src/features/settings/useMe';
import { invalidate } from '@/src/lib/query';
import { useTranslation } from 'react-i18next';

/** F6.2: create a fixed charge; materialise and arm this/next month's reminders right away. */
export default function NewRecurringScreen() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => recurringApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [submitting, setSubmitting] = useState(false);

  if (catLoading || meLoading || !profile) {
    return <FormSkeleton blocks={FORM_LAYOUTS.recurring} />;
  }

  return (
    <RecurringForm
      categories={categories}
      currencies={currencies}
      defaultCurrency={profile.defaultCurrency}
      submitLabel={t('recurringForm.submit')}
      submitting={submitting}
      onSubmit={async (values) => {
        setSubmitting(true);
        try {
          await api.create(values);
          const { created } = await api.materialize();
          markMaterializationStale();
          void invalidate.plans(qc);
          const allowed = await ensureNotificationPermission(t('recurringForm.permission'));
          if (allowed) await syncReminders(created, makeCurrencyLookup(currencies));
          router.back();
        } catch (err) {
          Alert.alert(t('common.couldNotSave'), err instanceof Error ? err.message : String(err));
        } finally {
          setSubmitting(false);
        }
      }}
    />
  );
}
