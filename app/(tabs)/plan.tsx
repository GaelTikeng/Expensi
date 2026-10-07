import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { completePlan } from '@/src/features/planned/completeFlow';
import { CompleteSheet, type CompleteValues } from '@/src/features/planned/CompleteSheet';
import { FixedChargesView } from '@/src/features/planned/FixedChargesView';
import { PlannedRow } from '@/src/features/planned/PlannedRow';
import { PlanningView } from '@/src/features/planned/PlanningView';
import { useUpcomingPlanned } from '@/src/features/planned/usePlanned';
import type { PlannedDto } from '@/src/lib/schemas/planned';

type Tab = 'upcoming' | 'planning' | 'fixed';

/** F5.5 / F5.7 / F6.4: Upcoming · Planning · Fixed charges. */
export default function PlanScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { getToken } = useAuth();
  const { overdue, upcoming, loading, error, reload, skip, api, lookup } = useUpcomingPlanned();
  const [completing, setCompleting] = useState<PlannedDto | null>(null);
  const [busy, setBusy] = useState(false);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reload();
    }, [reload]),
  );

  const confirmComplete = async (values: CompleteValues) => {
    if (!completing) return;
    setBusy(true);
    try {
      const res = await completePlan(api, completing, values, getToken);
      setCompleting(null);
      if (res.parked) Alert.alert('Saved', 'The receipt will upload when you are back online.');
      void reload();
    } catch (err) {
      Alert.alert('Could not complete', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const sections = [
    ...(overdue.length ? [{ key: 'overdue', title: 'Overdue', data: overdue }] : []),
    ...(upcoming.length ? [{ key: 'upcoming', title: 'Upcoming', data: upcoming }] : []),
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        {(
          [
            ['upcoming', 'Upcoming'],
            ['planning', 'Planning'],
            ['fixed', 'Fixed charges'],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} style={[styles.segmentItem, tab === k && styles.segmentActive]} onPress={() => setTab(k)}>
            <Text style={[styles.segmentText, tab === k && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'planning' ? <PlanningView lookup={lookup} /> : null}
      {tab === 'fixed' ? <FixedChargesView lookup={lookup} /> : null}

      {tab === 'upcoming' ? (
        loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(p) => p.id}
            stickySectionHeadersEnabled
            onRefresh={reload}
            refreshing={false}
            contentContainerStyle={sections.length === 0 ? { flexGrow: 1 } : { paddingBottom: 100 }}
            renderSectionHeader={({ section }) => (
              <Text style={[styles.sectionTitle, section.key === 'overdue' && styles.overdue]}>{section.title}</Text>
            )}
            renderItem={({ item, section }) => (
              <PlannedRow
                item={item}
                currency={lookup(item.currency)}
                overdue={section.key === 'overdue'}
                onPress={() => router.push(`/planned/${item.id}`)}
                onDone={() => setCompleting(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={40} color="#bbb" />
                <Text style={styles.emptyTitle}>Nothing planned</Text>
                <Text style={styles.emptyText}>Plan an expense and we will remind you the day before and an hour before.</Text>
              </View>
            }
            ListFooterComponent={
              overdue.length ? (
                <Text style={styles.footerHint}>Overdue items: tap ✓ to mark paid, or open one to skip it.</Text>
              ) : null
            }
          />
        )
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === 'upcoming' ? (
        <Pressable style={styles.fab} onPress={() => router.push('/planned/new')} accessibilityLabel="Plan an expense">
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      ) : null}

      <CompleteSheet plan={completing} currency={lookup(completing?.currency ?? 'XAF')} busy={busy} onConfirm={confirmComplete} onClose={() => setCompleting(null)} />
      {void skip}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  segment: { flexDirection: 'row', backgroundColor: '#E3E6EB', borderRadius: 10, padding: 3, margin: 12 },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 13, color: '#555' },
  segmentTextActive: { color: '#111', fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#555', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F6F7F9' },
  overdue: { color: '#E67E22' },
  sep: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 62 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyText: { fontSize: 14, color: '#777', textAlign: 'center' },
  footerHint: { fontSize: 12, color: '#999', textAlign: 'center', padding: 16 },
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
