import { useAuth } from '@clerk/expo';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { plannedApi } from '@/src/features/planned/api';
import { PlannedRow } from '@/src/features/planned/PlannedRow';
import { useMe } from '@/src/features/settings/useMe';
import { endOfMonth, formatMonthLabel } from '@/src/lib/dates';
import type { PlannedDto } from '@/src/lib/schemas/planned';

/** F5.7: every plan (any status) scheduled in one month. */
export default function PlannedMonthScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);
  const [items, setItems] = useState<PlannedDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const start = `${month}-01`;
    api
      .list({ status: 'all', from: `${start}T00:00:00.000Z`, to: `${endOfMonth(start)}T23:59:59.999Z`, limit: 500 })
      .then((r) => {
        if (!cancelled) setItems(r.items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, month]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: formatMonthLabel(`${month}-01`) }} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!items && !error ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
      {items ? (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<Text style={styles.empty}>Nothing planned this month.</Text>}
          renderItem={({ item }) => (
            <PlannedRow item={item} currency={lookup(item.currency)} overdue={item.status === 'planned' && new Date(item.scheduledAt).getTime() < now} onPress={() => router.push(`/planned/${item.id}`)} />
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  sep: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 62 },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  error: { color: '#C0392B', padding: 16 },
});
