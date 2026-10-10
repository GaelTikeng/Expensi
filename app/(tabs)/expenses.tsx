import { router } from 'expo-router';
import { CloudUpload, Plus, Search } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';

import { useActionSheets } from '@/src/components/action-sheet';

import { ExpenseListSkeleton } from '@/src/components/skeletons';
import { TabScreen } from '@/src/components/tab-screen';
import { Icon } from '@/src/components/ui/icon';
import { Input } from '@/src/components/ui/input';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group';
import { ExpenseRow } from '@/src/features/expenses/ExpenseRow';
import { formatTotals, makeCurrencyLookup, sumByCurrency } from '@/src/features/expenses/money-utils';
import { useCategories } from '@/src/features/expenses/useCategories';
import { useExpenses } from '@/src/features/expenses/useExpenses';
import { useMe } from '@/src/features/settings/useMe';
import { formatMonthLabel, monthKey } from '@/src/lib/dates';
import { keys, useRefetchOnFocus } from '@/src/lib/query';
import type { ExpenseDto } from '@/src/lib/schemas/expense';

const PROOF_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'with', label: 'With proof' },
  { value: 'without', label: 'Without proof' },
] as const;

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
  const { confirm } = useActionSheets();
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  // Pick up changes made in the create/edit screens, in the background.
  useRefetchOnFocus(keys.expenses.all);

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

  const confirmDelete = async (e: ExpenseDto) => {
    if (await confirm({ title: 'Delete expense?', message: e.description, actionLabel: 'Delete' })) await remove(e.id).catch(() => undefined);
  };

  return (
    <TabScreen>
      <View className="m-3 flex-row items-center gap-2">
        <View className="flex-1 justify-center">
          <Input
            className="bg-card pl-9"
            placeholder="Search description or payee"
            value={searchText}
            onChangeText={onSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <View className="absolute left-3" pointerEvents="none">
            <Icon as={Search} className="text-muted-foreground size-[18px]" />
          </View>
        </View>
        <Pressable
          className="bg-card border-input active:bg-accent size-10 items-center justify-center rounded-md border"
          onPress={() => router.push('/import')}
          hitSlop={6}
          accessibilityLabel="Import a file"
        >
          <Icon as={CloudUpload} className="text-primary size-[22px]" />
        </Pressable>
      </View>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={proof}
        onValueChange={(v) => {
          if (v) setProof(v as typeof proof);
        }}
        className="bg-card mx-3 mb-2"
      >
        {PROOF_FILTERS.map((f, i) => (
          <ToggleGroupItem key={f.value} value={f.value} isFirst={i === 0} isLast={i === PROOF_FILTERS.length - 1} className="flex-1" aria-label={f.label}>
            <Text>{f.label}</Text>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {loading ? (
        <View className="flex-1">
          <ExpenseListSkeleton />
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
            <View className="bg-background flex-row justify-between px-4 py-2">
              <Text className="text-muted-foreground text-[13px] font-semibold uppercase">{section.title}</Text>
              <Text className="text-muted-foreground text-[13px]">{section.total}</Text>
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
          ItemSeparatorComponent={() => <Separator className="ml-[62px]" />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-1.5 p-8">
              <Text variant="large">{query ? 'No matches' : 'No expenses yet'}</Text>
              <Text variant="muted">{query ? 'Try another search.' : 'Tap + to record your first one.'}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <>
                <Separator className="ml-[62px]" />
                <ExpenseListSkeleton rows={2} header={false} />
              </>
            ) : null
          }
          contentContainerClassName={items.length === 0 ? 'grow' : undefined}
        />
      )}

      {error ? <Text className="text-destructive p-3 text-[13px]">{error}</Text> : null}

      <Pressable
        className="bg-primary absolute bottom-6 right-5 size-14 items-center justify-center rounded-full shadow-lg shadow-black/20 active:opacity-90"
        onPress={() => router.push('/expense/new')}
        accessibilityLabel="Add expense"
      >
        <Icon as={Plus} className="text-primary-foreground size-7" />
      </Pressable>
    </TabScreen>
  );
}
