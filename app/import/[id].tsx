import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCategories } from '@/src/features/expenses/useCategories';
import { makeCurrencyLookup } from '@/src/features/expenses/money-utils';
import { importsApi } from '@/src/features/imports/api';
import { ImportItemRow } from '@/src/features/imports/ImportItemRow';
import { ItemEditModal } from '@/src/features/imports/ItemEditModal';
import { committableIds, reviewItems } from '@/src/features/imports/review-utils';
import { useMe } from '@/src/features/settings/useMe';
import { formatMoney } from '@/src/lib/money';
import type { ImportDetailResponse, ImportItemDto, ImportItemPatch } from '@/src/lib/schemas/import';

/** F3.8–F3.11: process, review, edit, reconcile, commit. */
export default function ImportReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const api = useMemo(() => importsApi(getToken), [getToken]);
  const { categories, byId: categoryById } = useCategories();
  const { currencies } = useMe();
  const lookup = useMemo(() => makeCurrencyLookup(currencies), [currencies]);

  const [detail, setDetail] = useState<ImportDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ImportItemDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const initialised = useRef(false);

  const reviewed = useMemo(() => (detail ? reviewItems(detail.items) : []), [detail]);

  // Apply default ticks once, when staged rows first arrive.
  useEffect(() => {
    if (!detail || initialised.current || detail.import.status !== 'review') return;
    initialised.current = true;
    setSelected(new Set(reviewed.filter((r) => r.defaultSelected).map((r) => r.item.id)));
  }, [detail, reviewed]);

  const run = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      setDetail(await api.process(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }, [api, id]);

  // Load; if the file has not been processed yet, kick it off.
  useEffect(() => {
    let cancelled = false;
    api
      .get(id)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        if (d.import.status === 'queued' || d.import.status === 'processing') void run();
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [api, id, run]);

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

  const ids = committableIds(reviewed, selected);
  const skipped = [...selected].filter((s) => !ids.includes(s)).length;

  const commit = () =>
    Alert.alert(
      `Add ${ids.length} expense${ids.length === 1 ? '' : 's'}?`,
      skipped > 0 ? `${skipped} ticked line${skipped > 1 ? 's are' : ' is'} missing an amount or date and will be skipped.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            setCommitting(true);
            try {
              const res = await api.commit(id, ids);
              Alert.alert('Done', `${res.created} expense${res.created === 1 ? '' : 's'} added.`, [{ text: 'OK', onPress: () => router.back() }]);
            } catch (err) {
              Alert.alert('Could not commit', err instanceof Error ? err.message : String(err));
            } finally {
              setCommitting(false);
            }
          },
        },
      ],
    );

  if (error && !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.secondary} onPress={run}>
          <Text style={styles.secondaryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (!detail || processing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>{processing ? 'Reading your file with AI…' : 'Loading…'}</Text>
        <Text style={styles.hintSmall}>This usually takes 10 to 40 seconds.</Text>
      </View>
    );
  }

  const imp = detail.import;
  const currency = lookup(imp.detectedCurrency && imp.detectedCurrency !== 'UNKNOWN' ? imp.detectedCurrency.slice(0, 3) : (detail.items[0]?.currency ?? 'XAF'));
  const rec = detail.reconciliation;
  const selectedTotal = detail.items.filter((i) => ids.includes(i.id)).reduce((s, i) => s + (i.amountMinor ?? 0), 0);

  if (imp.status === 'failed') {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color="#C0392B" />
        <Text style={styles.failTitle}>Could not read this file</Text>
        <Text style={styles.error}>{imp.failureReason ?? 'Unknown error'}</Text>
        {imp.attemptCount < 3 ? (
          <Pressable style={styles.secondary} onPress={run}>
            <Text style={styles.secondaryText}>Try again ({3 - imp.attemptCount} left)</Text>
          </Pressable>
        ) : (
          <Text style={styles.hintSmall}>Upload the file again to retry.</Text>
        )}
      </View>
    );
  }

  const readOnly = imp.status === 'committed';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: imp.originalFilename ?? 'Review import' }} />

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>
          {detail.items.length} lines · {reviewed.filter((r) => r.item.lineKind === 'expense').length} expenses
          {imp.documentQuality === 'poor' ? ' · poor quality' : ''}
        </Text>
        {rec.statedTotalMinor != null ? (
          <Text style={[styles.recon, rec.discrepancyMinor === 0 ? styles.reconOk : styles.reconBad]}>
            {rec.discrepancyMinor === 0
              ? `Matches the written total of ${formatMoney(rec.statedTotalMinor, currency)}`
              : `Written total ${formatMoney(rec.statedTotalMinor, currency)} vs lines ${formatMoney(rec.computedTotalMinor, currency)} (off by ${formatMoney(Math.abs(rec.discrepancyMinor ?? 0), currency)}) — a digit may be misread`}
          </Text>
        ) : null}
        {imp.documentQuality === 'poor' ? <Text style={styles.reconBad}>The document is hard to read. Consider re-exporting or re-scanning it.</Text> : null}
        {readOnly ? <Text style={styles.reconOk}>Committed on {new Date(imp.committedAt ?? imp.updatedAt).toLocaleDateString()}</Text> : null}
      </View>

      {!readOnly ? (
        <View style={styles.bulk}>
          <Pressable onPress={() => setSelected(new Set(reviewed.filter((r) => r.item.lineKind === 'expense' && r.severity !== 'blocked').map((r) => r.item.id)))}>
            <Text style={styles.bulkText}>Tick all</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(new Set())}>
            <Text style={styles.bulkText}>Untick all</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={reviewed}
        keyExtractor={(r) => r.item.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={styles.list}
        renderItem={({ item: r }) => (
          <ImportItemRow
            reviewed={r}
            selected={readOnly ? r.item.reviewState === 'accepted' : selected.has(r.item.id)}
            currency={lookup(r.item.currency ?? currency.code)}
            categoryName={r.item.categoryId ? categoryById.get(r.item.categoryId)?.name : undefined}
            onToggle={() => !readOnly && toggle(r.item.id)}
            onEdit={() => !readOnly && setEditing(r.item)}
          />
        )}
      />

      {!readOnly ? (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerCount}>{ids.length} selected</Text>
            <Text style={styles.footerTotal}>{formatMoney(selectedTotal, currency)}</Text>
          </View>
          <Pressable style={[styles.primary, (ids.length === 0 || committing) && styles.disabled]} disabled={ids.length === 0 || committing} onPress={commit}>
            {committing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Add to expenses</Text>}
          </Pressable>
        </View>
      ) : null}

      <ItemEditModal item={editing} currency={currency} categories={categories} saving={saving} onSave={saveEdit} onClose={() => setEditing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  hint: { fontSize: 15, color: '#555' },
  hintSmall: { fontSize: 12, color: '#999' },
  error: { color: '#C0392B', textAlign: 'center' },
  failTitle: { fontSize: 18, fontWeight: '600' },
  summary: { padding: 16, gap: 6, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E3E6EB' },
  summaryTitle: { fontSize: 14, color: '#555' },
  recon: { fontSize: 13 },
  reconOk: { color: '#27AE60', fontSize: 13 },
  reconBad: { color: '#C0392B', fontSize: 13 },
  bulk: { flexDirection: 'row', gap: 20, paddingHorizontal: 16, paddingVertical: 8 },
  bulkText: { color: '#1F5EFF', fontSize: 13 },
  list: { paddingBottom: 120 },
  sep: { height: 1, backgroundColor: '#EEF0F3' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E3E6EB',
  },
  footerCount: { fontSize: 12, color: '#777' },
  footerTotal: { fontSize: 18, fontWeight: '700' },
  primary: { backgroundColor: '#1F5EFF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondary: { borderWidth: 1, borderColor: '#1F5EFF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  secondaryText: { color: '#1F5EFF', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
