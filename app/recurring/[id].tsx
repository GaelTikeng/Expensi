import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { FORM_LAYOUTS, FormSkeleton } from '@/src/components/skeletons';
import { useActionSheets } from '@/src/components/action-sheet';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { useCategories } from '@/src/features/expenses/useCategories';
import { recurringApi } from '@/src/features/planned/api';
import { RecurringForm } from '@/src/features/planned/RecurringForm';
import { markMaterializationStale, useRecurringList } from '@/src/features/planned/usePlanned';
import { useMe } from '@/src/features/settings/useMe';
import { errorMessage, invalidate } from '@/src/lib/query';

/** F6.2: edit / deactivate / delete a fixed charge. */
export default function RecurringDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => recurringApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [submitting, setSubmitting] = useState(false);
  const { confirm } = useActionSheets();

  const list = useRecurringList();
  const charge = list.data?.items.find((c) => c.id === id) ?? null;
  const error = errorMessage(list.error) ?? (list.data && !charge ? 'Fixed charge not found' : null);

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this fixed charge?',
      message: 'Future unpaid plans for it are removed; past payments stay in your expenses.',
      actionLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.remove(id);
      void invalidate.plans(qc);
      router.back();
    } catch (err) {
      Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
    }
  };

  if (error) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Text className="text-destructive">{error}</Text>
      </View>
    );
  }
  if (!charge || catLoading || meLoading || !profile) {
    // Editing adds the "Active" group at the end of the form.
    return <FormSkeleton blocks={[...FORM_LAYOUTS.recurring, 1]} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: charge.name,
          headerRight: () => (
            <Pressable onPress={remove} hitSlop={12} accessibilityLabel="Delete">
              <Icon as={Trash2} className="text-destructive size-[22px]" />
            </Pressable>
          ),
        }}
      />
      <RecurringForm
        initial={charge}
        categories={categories}
        currencies={currencies}
        defaultCurrency={profile.defaultCurrency}
        submitLabel="Save changes"
        submitting={submitting}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            const { id: _ignored, ...patch } = values;
            await api.update(id, patch);
            // Amount/day changes apply from next materialisation; this month's
            // existing plan is left as the user may already have acted on it.
            await api.materialize().catch(() => undefined);
            markMaterializationStale();
            void invalidate.plans(qc);
            router.back();
          } catch (err) {
            Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}
