import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { expensesApi } from '@/src/features/expenses/api';
import { ExpenseForm } from '@/src/features/expenses/ExpenseForm';
import { useCategories } from '@/src/features/expenses/useCategories';
import { useMe } from '@/src/features/settings/useMe';

/** F2.5: create. */
export default function NewExpenseScreen() {
  const { getToken } = useAuth();
  const api = useMemo(() => expensesApi(getToken), [getToken]);
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
    <ExpenseForm
      categories={categories}
      currencies={currencies}
      defaultCurrency={profile.defaultCurrency}
      submitLabel="Save expense"
      submitting={submitting}
      onSubmit={async (values) => {
        setSubmitting(true);
        try {
          await api.create(values);
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
