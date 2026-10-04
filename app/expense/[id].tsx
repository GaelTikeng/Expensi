import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AttachmentsSection } from '@/src/features/attachments/AttachmentsSection';
import { expensesApi } from '@/src/features/expenses/api';
import { ExpenseForm } from '@/src/features/expenses/ExpenseForm';
import { useCategories } from '@/src/features/expenses/useCategories';
import { useMe } from '@/src/features/settings/useMe';
import type { ExpenseDto } from '@/src/lib/schemas/expense';

/** F2.7: detail + edit + delete. */
export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const api = useMemo(() => expensesApi(getToken), [getToken]);
  const { categories, loading: catLoading } = useCategories();
  const { profile, currencies, loading: meLoading } = useMe();

  const [expense, setExpense] = useState<ExpenseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(id)
      .then((e) => {
        if (!cancelled) setExpense(e);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const confirmDelete = () =>
    Alert.alert('Delete expense?', 'This cannot be undone.', [
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
  if (!expense || catLoading || meLoading || !profile) {
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
          title: 'Expense',
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={12} accessibilityLabel="Delete">
              <Ionicons name="trash-outline" size={22} color="#C0392B" />
            </Pressable>
          ),
        }}
      />
      {expense.importItemId ? (
        <View style={styles.banner}>
          <Ionicons name="document-text-outline" size={16} color="#1F5EFF" />
          <Text style={styles.bannerText}>Imported from a file. Import history arrives with E3.</Text>
        </View>
      ) : null}
      <ExpenseForm
        initial={expense}
        categories={categories}
        currencies={currencies}
        defaultCurrency={profile.defaultCurrency}
        submitLabel="Save changes"
        submitting={submitting}
        extra={<AttachmentsSection expenseId={expense.id} />}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            const { id: _ignored, ...patch } = values;
            const saved = await api.update(id, patch);
            setExpense(saved);
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    marginBottom: 0,
    padding: 10,
    backgroundColor: '#E8F0FF',
    borderRadius: 10,
  },
  bannerText: { fontSize: 13, color: '#1F5EFF', flex: 1 },
});
