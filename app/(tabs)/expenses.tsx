import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ExpenseRow } from '@/src/features/expenses/ExpenseRow';
import { formatTotals, makeCurrencyLookup, sumByCurrency } from '@/src/features/expenses/money-utils';
import { useCategories } from '@/src/features/expenses/useCategories';
import { useExpenses } from '@/src/features/expenses/useExpenses';
import { useMe } from '@/src/features/settings/useMe';
import { formatMonthLabel, monthKey } from '@/src/lib/dates';
import type { ExpenseDto } from '@/src/lib/schemas/expense';

/** F2.6: list grouped by month, search, swipe to delete, FAB to add. */
export default function ExpensesScreen() {
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState<string | undefined>(undefined);
  const [proof, setProof] = useState<'all' | 'with' | 'without'>('all');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { items, loading, loadingMore, hasMore, error, refresh, loadMore, remove } = useExpenses({
    q: query,
    hasAttachment: proof === 'all' ? undefined : proof === 'with',
  });
  const { byId: categoryById } = useCategories();
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  // Pick up changes made in the create/edit screens.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refresh();
    }, [refresh]),
  );

  const onSearch = (t: string) => {
    setSearchText(t);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(t.trim() || undefined), 300);
  };

  const sections = useMemo(() => {
    const groups = new Map<string, ExpenseDto[]>();
    for (const e of items) {
      const k = monthKey(e.occurredOn);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()].map(([k, data]) => ({
      key: k,
      title: formatMonthLabel(`${k}-01`),
      total: formatTotals(sumByCurrency(data), lookup),
      data,
    }));
  }, [items, lookup]);

  const confirmDelete = (e: ExpenseDto) =>
    Alert.alert('Delete expense?', e.description, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(e.id).catch(() => undefined) },
    ]);

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#888" />
        <TextInput
          style={styles.search}
          placeholder="Search description or payee"
          value={searchText}
          onChangeText={onSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.chips}>
        {(['all', 'with', 'without'] as const).map((k) => (
          <Pressable key={k} style={[styles.chip, proof === k && styles.chipActive]} onPress={() => setProof(k)}>
            <Text style={[styles.chipText, proof === k && styles.chipTextActive]}>
              {k === 'all' ? 'All' : k === 'with' ? 'With proof' : 'Without proof'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.id}
          stickySectionHeadersEnabled
          onRefresh={refresh}
          refreshing={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => hasMore && loadMore()}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionTotal}>{section.total}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              category={item.categoryId ? categoryById.get(item.categoryId) : undefined}
              currency={lookup(item.currency)}
              onPress={() => router.push(`/expense/${item.id}`)}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No expenses yet'}</Text>
              <Text style={styles.emptyText}>{query ? 'Try another search.' : 'Tap + to record your first one.'}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null}
          contentContainerStyle={items.length === 0 ? { flexGrow: 1 } : undefined}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.fab} onPress={() => router.push('/expense/new')} accessibilityLabel="Add expense">
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E3E6EB',
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 15 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#D7DAE0', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#1F5EFF', borderColor: '#1F5EFF' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F6F7F9',
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#555', textTransform: 'uppercase' },
  sectionTotal: { fontSize: 13, color: '#555' },
  separator: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 62 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#777' },
  error: { color: '#C0392B', fontSize: 13, padding: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1F5EFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
