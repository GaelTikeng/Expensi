import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { PlannedListSkeleton } from '@/src/components/skeletons';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';

import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { plannedApi } from '@/src/features/planned/api';
import { PlannedRow } from '@/src/features/planned/PlannedRow';
import { useMe } from '@/src/features/settings/useMe';
import { endOfMonth, formatMonthLabel } from '@/src/lib/dates';
import { errorMessage, keys } from '@/src/lib/query';

/** F5.7: every plan (any status) scheduled in one month. */
export default function PlannedMonthScreen() {
  const { month } = useLocalSearchParams<{ month: string }>();
  const { getToken } = useAuth();
  const api = useMemo(() => plannedApi(getToken), [getToken]);
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);
  const [now] = useState(() => Date.now());

  const query = useQuery({
    queryKey: keys.planned.month(month),
    queryFn: async () => {
      const start = `${month}-01`;
      const r = await api.list({ status: 'all', from: `${start}T00:00:00.000Z`, to: `${endOfMonth(start)}T23:59:59.999Z`, limit: 500 });
      return r.items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    },
  });
  const items = query.data ?? null;
  const error = errorMessage(query.error);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: formatMonthLabel(`${month}-01`) }} />
      {error ? <Text className="text-destructive p-4">{error}</Text> : null}
      {!items && !error ? <PlannedListSkeleton rows={6} /> : null}
      {items ? (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={() => <Separator className="ml-[62px]" />}
          ListEmptyComponent={<Text className="text-muted-foreground p-6 text-center">Nothing planned this month.</Text>}
          renderItem={({ item }) => (
            <PlannedRow item={item} currency={lookup(item.currency)} overdue={item.status === 'planned' && new Date(item.scheduledAt).getTime() < now} onPress={() => router.push(`/planned/${item.id}`)} />
          )}
        />
      ) : null}
    </View>
  );
}
