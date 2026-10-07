import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCategories } from '@/src/features/expenses/useCategories';
import { recurringApi } from '@/src/features/planned/api';
import { RecurringForm } from '@/src/features/planned/RecurringForm';
import { useMe } from '@/src/features/settings/useMe';
import type { RecurringDto } from '@/src/lib/schemas/recurring';

/** F6.2: edit / deactivate / delete a fixed charge. */
export default function RecurringDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const api = useMemo(() => recurringApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();
  const [charge, setCharge] = useState<RecurringDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .list()
      .then((r) => {
        if (cancelled) return;
        const found = r.items.find((c) => c.id === id);
        if (found) setCharge(found);
        else setError('Fixed charge not found');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const remove = () =>
    Alert.alert('Delete this fixed charge?', 'Future unpaid plans for it are removed; past payments stay in your expenses.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.remove(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!charge || catLoading || meLoading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: charge.name,
          headerRight: () => (
            <Pressable onPress={remove} hitSlop={12} accessibilityLabel="Delete">
              <Ionicons name="trash-outline" size={22} color="#C0392B" />
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#C0392B' },
});
