import { useAuth } from '@clerk/expo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FileText, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { AttachmentsCardSkeleton, FORM_LAYOUTS, FormSkeleton } from '@/src/components/skeletons';
import { useActionSheets } from '@/src/components/action-sheet';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { AttachmentsSection } from '@/src/features/attachments/AttachmentsSection';
import { LocationMap } from '@/src/features/location/LocationMap';
import { expensesApi } from '@/src/features/expenses/api';
import { ExpenseForm } from '@/src/features/expenses/ExpenseForm';
import { useCategories } from '@/src/features/expenses/useCategories';
import { findCachedExpense } from '@/src/features/expenses/useExpenses';
import { useMe } from '@/src/features/settings/useMe';
import { errorMessage, invalidate, keys } from '@/src/lib/query';
import { useThemeColors } from '@/src/lib/theme';
import { useTranslation } from 'react-i18next';

/** F2.7: detail + edit + delete. */
export default function ExpenseDetailScreen() {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => expensesApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [submitting, setSubmitting] = useState(false);
  const { confirm } = useActionSheets();

  const query = useQuery({
    queryKey: keys.expenses.detail(id),
    queryFn: () => api.get(id),
    // Open at once with the row the list already holds; the fetch refreshes it.
    placeholderData: () => findCachedExpense(qc, id),
  });
  const expense = query.data ?? null;
  const error = errorMessage(query.error);

  const confirmDelete = async () => {
    if (!(await confirm({ title: t('expenses.deleteConfirm'), message: t('common.cannotBeUndone'), actionLabel: t('common.delete') }))) return;
    try {
      await api.remove(id);
      void invalidate.expenses(qc);
      router.back();
    } catch (err) {
      Alert.alert(t('common.couldNotDelete'), err instanceof Error ? err.message : String(err));
    }
  };

  if (error) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text className="text-destructive">{error}</Text>
      </View>
    );
  }
  if (!expense || catLoading || meLoading || !profile) {
    return <FormSkeleton blocks={FORM_LAYOUTS.expense} extra={<AttachmentsCardSkeleton />} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('screens.expense'),
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={12} accessibilityLabel={t('common.delete')}>
              <Icon as={Trash2} size={22} color={theme.destructive} />
            </Pressable>
          ),
        }}
      />
      {expense.importItemId ? (
        <View className="bg-accent mx-4 mt-4 flex-row items-center gap-2 rounded-[10px] p-2.5">
          <Icon as={FileText} className="text-accent-foreground size-4" />
          <Text className="text-accent-foreground flex-1 text-[13px]">{t('expenses.importedBanner')}</Text>
        </View>
      ) : null}
      <ExpenseForm
        initial={expense}
        categories={categories}
        currencies={currencies}
        defaultCurrency={profile.defaultCurrency}
        submitLabel={t('common.saveChanges')}
        submitting={submitting}
        extra={
          <>
            {expense.latitude != null && expense.longitude != null ? (
              <LocationMap place={{ latitude: expense.latitude, longitude: expense.longitude, locationLabel: expense.locationLabel }} />
            ) : null}
            <AttachmentsSection expenseId={expense.id} />
          </>
        }
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            const { id: _ignored, ...patch } = values;
            const saved = await api.update(id, patch);
            qc.setQueryData(keys.expenses.detail(id), saved);
            void invalidate.expenses(qc);
            router.back();
          } catch (err) {
            Alert.alert(t('common.couldNotSave'), err instanceof Error ? err.message : String(err));
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}
