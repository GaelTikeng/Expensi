import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, View } from 'react-native';

import { loadingA11y, SkeletonLine } from '@/src/components/skeletons';
import { useActionSheets } from '@/src/components/action-sheet';
import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Text } from '@/src/components/ui/text';
import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { importsApi } from '@/src/features/imports/api';
import { ImportItemRow } from '@/src/features/imports/ImportItemRow';
import { ItemEditModal } from '@/src/features/imports/ItemEditModal';
import { DuplicateSheet, type DuplicatePair } from '@/src/features/imports/DuplicateSheet';
import { expensesApi } from '@/src/features/expenses/api';
import { committableIds, reviewItems } from '@/src/features/imports/review-utils';
import { useMe } from '@/src/features/settings/useMe';
import { formatMoney } from '@/src/lib/money';
import { errorMessage, invalidate, keys } from '@/src/lib/query';
import type { ImportDetailResponse, ImportItemDto, ImportItemPatch } from '@/src/lib/schemas/import';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

/** F3.8–F3.11: process, review, edit, reconcile, commit. */
export default function ImportReviewScreen() {
  const theme = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const api = useMemo(() => importsApi(getToken), [getToken]);
  const expenses = useMemo(() => expensesApi(getToken), [getToken]);
  const { categories, byId: categoryById } = useCategories();
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  const query = useQuery({
    queryKey: keys.imports.detail(id),
    queryFn: () => api.get(id),
    // While the server is processing, poll: if the phone's request drops
    // (mobile fetch gives up after a minute or two), the server carries on
    // and the row flips to review / failed on its own.
    refetchInterval: (q) => (q.state.data?.import.status === 'processing' ? 5000 : false),
  });
  const detail = query.data ?? null;
  const setDetail = useCallback((d: ImportDetailResponse) => qc.setQueryData(keys.imports.detail(id), d), [qc, id]);
  // The AI step (F3.5–F3.7) as a mutation: its pending/error state drives the screen.
  const { mutate: run, isPending: requestInFlight, error: processError } = useMutation({
    mutationFn: () => api.process(id),
    onSuccess: setDetail,
  });
  const processing = requestInFlight || detail?.import.status === 'processing';
  const error = errorMessage(query.error);
  // A dropped request shows as an error while the row still says processing.
  const lostConnection = Boolean(processError) && !requestInFlight && detail?.import.status === 'processing';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ImportItemDto | null>(null);
  const [comparing, setComparing] = useState<DuplicatePair | null>(null);
  const { confirm } = useActionSheets();
  const [resolving, setResolving] = useState(false);
  // Lines the user chose to import despite the duplicate warning.
  const [acceptedDuplicates, setAcceptedDuplicates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const initialised = useRef(false);

  const reviewed = useMemo(
    () => (detail ? reviewItems(detail.items.map((i) => (acceptedDuplicates.has(i.id) ? { ...i, possibleDuplicateOf: null } : i))) : []),
    [detail, acceptedDuplicates],
  );

  // Apply default ticks once, when staged rows first arrive.
  useEffect(() => {
    if (!detail || initialised.current || detail.import.status !== 'review') return;
    initialised.current = true;
    setSelected(new Set(reviewed.filter((r) => r.defaultSelected).map((r) => r.item.id)));
  }, [detail, reviewed]);

  // If the file has not been processed yet, kick it off once.
  const kicked = useRef(false);
  useEffect(() => {
    if (!detail || kicked.current) return;
    if (detail.import.status === 'queued' || detail.import.status === 'processing') {
      kicked.current = true;
      run();
    }
  }, [detail, run]);

  const toggle = (itemId: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
    });

  const saveEdit = async (patch: ImportItemPatch) => {
    if (!editing || !detail) return;
    setSaving(true);
    try {
      const updated = await api.patchItem(id, editing.id, patch);
      setDetail({ ...detail, items: detail.items.map((i) => (i.id === updated.id ? { ...i, ...updated, possibleDuplicateOf: i.possibleDuplicateOf } : i)) });
      if (updated.lineKind === 'expense' && updated.amountMinor && updated.occurredOn) setSelected((s) => new Set(s).add(updated.id));
      setEditing(null);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // F3.14: resolve a duplicate by deleting one of the two expenses.
  const deleteExpense = async (expenseId: string, keepLineTicked: boolean) => {
    if (!comparing) return;
    setResolving(true);
    try {
      await expenses.remove(expenseId);
      void invalidate.expenses(qc);
      await query.refetch();
      if (keepLineTicked) setSelected((s) => new Set(s).add(comparing.item.id));
      setComparing(null);
    } catch (err) {
      Alert.alert('Could not delete', err instanceof Error ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  };
  const confirmDelete = async (what: string, expenseId: string, keepLineTicked: boolean) => {
    if (await confirm({ title: `Delete ${what}?`, message: 'This cannot be undone.', actionLabel: 'Delete' })) await deleteExpense(expenseId, keepLineTicked);
  };

  const ids = committableIds(reviewed, selected);
  const skipped = [...selected].filter((s) => !ids.includes(s)).length;

  const commit = async () => {
    const ok = await confirm({
      title: `Add ${ids.length} expense${ids.length === 1 ? '' : 's'}?`,
      message: skipped > 0 ? `${skipped} ticked line${skipped > 1 ? 's are' : ' is'} missing an amount or date and will be skipped.` : undefined,
      actionLabel: `Add ${ids.length === 1 ? 'it' : 'them'}`,
      destructive: false,
    });
    if (!ok) return;
    setCommitting(true);
    try {
      const res = await api.commit(id, ids);
      void invalidate.expenses(qc);
      void invalidate.imports(qc);
      Alert.alert('Done', `${res.created} expense${res.created === 1 ? '' : 's'} added.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('Could not commit', err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  };

  if (error && !detail) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-2.5 p-6">
        <Text className="text-destructive text-center">{error}</Text>
        <Button variant="outline" className="border-primary" onPress={() => run()}>
          <Text className="text-primary font-semibold">Try again</Text>
        </Button>
      </View>
    );
  }
  // The AI step takes one to three minutes and keeps its explanatory spinner;
  // the plain fetch before it gets a skeleton of the review list.
  if (processing) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-2.5 p-6">
        <ActivityIndicator color={theme.mutedForeground} />
        <Text className="text-muted-foreground text-[15px]">Reading your file with AI…</Text>
        <Text className="text-muted-foreground text-xs">This usually takes one to three minutes. You can leave and come back.</Text>
        {lostConnection ? (
          <>
            <Text className="text-muted-foreground mt-3 text-center text-xs">The connection dropped, but the server is still working; this screen checks every few seconds.</Text>
            <Button variant="outline" size="sm" className="border-primary" onPress={() => run()}>
              <Text className="text-primary">Restart the reading</Text>
            </Button>
          </>
        ) : null}
      </View>
    );
  }
  if (!detail) return <ReviewSkeleton />;

  const imp = detail.import;
  const currency = lookup(imp.detectedCurrency && imp.detectedCurrency !== 'UNKNOWN' ? imp.detectedCurrency.slice(0, 3) : (detail.items[0]?.currency ?? 'XAF'));
  const rec = detail.reconciliation;
  const selectedTotal = detail.items.filter((i) => ids.includes(i.id)).reduce((s, i) => s + (i.amountMinor ?? 0), 0);

  if (imp.status === 'failed') {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-2.5 p-6">
        <Icon as={CircleAlert} className="text-destructive size-10" />
        <Text variant="large">Could not read this file</Text>
        <Text className="text-destructive text-center">{imp.failureReason ?? 'Unknown error'}</Text>
        {imp.attemptCount < 3 ? (
          <Button variant="outline" className="border-primary" onPress={() => run()}>
            <Text className="text-primary font-semibold">Try again ({3 - imp.attemptCount} left)</Text>
          </Button>
        ) : (
          <Text className="text-muted-foreground text-xs">Upload the file again to retry.</Text>
        )}
      </View>
    );
  }

  const readOnly = imp.status === 'committed';
  const matches = rec.discrepancyMinor === 0;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: imp.originalFilename ?? 'Review import' }} />

      <View className="bg-card border-border gap-1.5 border-b p-4">
        <Text className="text-muted-foreground text-sm">
          {detail.items.length} lines · {reviewed.filter((r) => r.item.lineKind === 'expense').length} expenses
          {imp.documentQuality === 'poor' ? ' · poor quality' : ''}
        </Text>
        {rec.statedTotalMinor != null ? (
          <View className={cn('rounded-md px-3 py-2', matches ? 'bg-success/10' : 'bg-destructive/10')}>
            <Text className={cn('text-[13px]', matches ? 'text-success' : 'text-destructive')}>
              {matches
                ? `Matches the written total of ${formatMoney(rec.statedTotalMinor, currency)}`
                : `Written total ${formatMoney(rec.statedTotalMinor, currency)} vs lines ${formatMoney(rec.computedTotalMinor, currency)} (off by ${formatMoney(Math.abs(rec.discrepancyMinor ?? 0), currency)}) — a digit may be misread`}
            </Text>
          </View>
        ) : null}
        {imp.documentQuality === 'poor' ? (
          <Text className="text-destructive text-[13px]">The document is hard to read. Consider re-exporting or re-scanning it.</Text>
        ) : null}
        {readOnly ? <Text className="text-success text-[13px]">Committed on {new Date(imp.committedAt ?? imp.updatedAt).toLocaleDateString()}</Text> : null}
      </View>

      {!readOnly ? (
        <View className="flex-row gap-5 px-4 py-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(new Set(reviewed.filter((r) => r.item.lineKind === 'expense' && r.severity !== 'blocked').map((r) => r.item.id)))}
          >
            <Text className="text-primary text-[13px]">Tick all</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSelected(new Set())}>
            <Text className="text-primary text-[13px]">Untick all</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={reviewed}
        keyExtractor={(r) => r.item.id}
        ItemSeparatorComponent={() => <Separator />}
        contentContainerClassName="pb-[120px]"
        renderItem={({ item: r }) => (
          <ImportItemRow
            reviewed={r}
            selected={readOnly ? r.item.reviewState === 'accepted' : selected.has(r.item.id)}
            currency={lookup(r.item.currency ?? currency.code)}
            categoryName={r.item.categoryId ? categoryById.get(r.item.categoryId)?.name : undefined}
            onToggle={() => !readOnly && toggle(r.item.id)}
            onEdit={() => !readOnly && setEditing(r.item)}
            onCompare={r.item.possibleDuplicateOf ? () => setComparing({ item: r.item, existing: r.item.possibleDuplicateOf! }) : undefined}
          />
        )}
      />

      {!readOnly ? (
        <View className="bg-card border-border absolute bottom-0 left-0 right-0 flex-row items-center justify-between border-t p-4 pb-7">
          <View>
            <Text className="text-muted-foreground text-xs">{ids.length} selected</Text>
            <Text className="text-lg font-bold">{formatMoney(selectedTotal, currency)}</Text>
          </View>
          <Button size="lg" className="px-5" disabled={ids.length === 0 || committing} onPress={commit}>
            {committing ? <ActivityIndicator color={theme.primaryForeground} /> : <Text className="text-[15px] font-semibold">Add to expenses</Text>}
          </Button>
        </View>
      ) : null}

      <ItemEditModal item={editing} currency={currency} categories={categories} saving={saving} onSave={saveEdit} onClose={() => setEditing(null)} />
      <DuplicateSheet
        pair={comparing}
        currency={currency}
        categoryName={(cid) => (cid ? categoryById.get(cid)?.name : undefined)}
        committed={readOnly}
        busy={resolving}
        onSkip={() => {
          if (comparing) setSelected((s) => {
            const n = new Set(s);
            n.delete(comparing.item.id);
            return n;
          });
          setComparing(null);
        }}
        onKeepBoth={() => {
          if (comparing) {
            setAcceptedDuplicates((s) => new Set(s).add(comparing.item.id));
            setSelected((s) => new Set(s).add(comparing.item.id));
          }
          setComparing(null);
        }}
        onDeleteExisting={() => comparing && confirmDelete('the saved expense', comparing.existing.id, !readOnly)}
        onDeleteThis={() => {
          if (!comparing?.item.expenseId) return Alert.alert('Not found', 'This line has no saved expense to delete.');
          confirmDelete('this expense', comparing.item.expenseId, false);
        }}
        onClose={() => setComparing(null)}
      />
    </View>
  );
}

/** Mirrors the summary header, the tick/untick links and the ImportItemRows. */
function ReviewSkeleton() {
  return (
    <View className="bg-background flex-1" {...loadingA11y}>
      <View className="bg-card border-border gap-2.5 border-b p-4">
        <SkeletonLine className="h-3.5 w-44" />
        <Skeleton className="h-9 rounded-md" />
      </View>
      <View className="flex-row gap-5 px-4 py-3">
        <SkeletonLine className="w-12" />
        <SkeletonLine className="w-16" />
      </View>
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i}>
          {i > 0 ? <Separator /> : null}
          <View className="bg-card flex-row items-center gap-2.5 px-3 py-3">
            <View className="w-7 items-center">
              <Skeleton className="size-5 rounded-[5px]" />
            </View>
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-1.5">
                <Skeleton className="size-2 rounded-full" />
                <SkeletonLine className={cn('h-3.5', ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5'][i % 4])} />
                <View className="flex-1" />
                <SkeletonLine className="h-3.5 w-16" />
              </View>
              <SkeletonLine className="ml-3.5 w-32" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
