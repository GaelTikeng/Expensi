import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { importsApi } from '@/src/features/imports/api';
import { pickImportFile, uploadImportFile } from '@/src/features/imports/upload';
import type { ImportDto } from '@/src/lib/schemas/import';

const STATUS_LABEL: Record<ImportDto['status'], string> = {
  queued: 'Waiting',
  processing: 'Processing…',
  review: 'Ready to review',
  committed: 'Committed',
  failed: 'Failed',
};
const STATUS_COLOR: Record<ImportDto['status'], string> = {
  queued: '#888',
  processing: '#1F5EFF',
  review: '#E67E22',
  committed: '#27AE60',
  failed: '#C0392B',
};

/** F3.4 + F3.12: import history and the entry point for a new file. */
export default function ImportsScreen() {
  const { getToken } = useAuth();
  const api = useMemo(() => importsApi(getToken), [getToken]);
  const [items, setItems] = useState<ImportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await api.list();
      setItems(page.items);
    } catch (err) {
      Alert.alert('Could not load imports', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const startImport = async () => {
    try {
      const file = await pickImportFile();
      if (!file) return;
      setUploading(0);
      const created = await uploadImportFile(file, getToken, setUploading);
      setUploading(null);
      router.push(`/import/${created.id}`);
    } catch (err) {
      setUploading(null);
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.screen}>
      <Pressable style={[styles.primary, uploading !== null && styles.disabled]} onPress={startImport} disabled={uploading !== null}>
        {uploading !== null ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.primaryText}>Uploading {Math.round(uploading * 100)}%</Text>
          </>
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.primaryText}>Import Excel, CSV or PDF</Text>
          </>
        )}
      </Pressable>
      <Text style={styles.help}>Rows are extracted by AI and staged for your review. Nothing is added to your expenses until you confirm.</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<Text style={styles.empty}>No imports yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/import/${item.id}`)}>
              <Ionicons name={item.sourceType.startsWith('pdf') ? 'document-text-outline' : 'grid-outline'} size={22} color="#555" />
              <View style={styles.rowBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.originalFilename ?? item.id}
                </Text>
                <Text style={styles.meta}>
                  {new Date(item.createdAt).toLocaleDateString()} · {item.itemCount ?? 0} lines
                </Text>
              </View>
              <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9', padding: 16, gap: 8 },
  primary: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F5EFF', borderRadius: 12, paddingVertical: 14 },
  disabled: { opacity: 0.7 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  help: { fontSize: 12, color: '#777', textAlign: 'center', marginBottom: 8 },
  list: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 48 },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500' },
  meta: { fontSize: 12, color: '#777' },
  status: { fontSize: 12, fontWeight: '600' },
});
