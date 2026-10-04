import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AttachmentDto } from '@/src/lib/schemas/attachment';
import { ImageViewerModal, openAttachment } from './AttachmentViewer';
import { AddTile, FileTile } from './FileTile';
import { chooseSource } from './pick';
import { useAttachments } from './useAttachments';

/** F2b.5 / F2b.6 for an existing expense: strip of proofs with add, view, delete. */
export function AttachmentsSection({ expenseId }: { expenseId: string }) {
  const { items, uploading, queued, loading, error, add, remove, api } = useAttachments(expenseId);
  const [viewer, setViewer] = useState<{ attachment: AttachmentDto; url: string } | null>(null);

  const open = async (a: AttachmentDto) => {
    try {
      const url = a.url ?? (await api.url(a.id)).url;
      await openAttachment(a, url, (att, u) => setViewer({ attachment: att, url: u }));
    } catch (err) {
      Alert.alert('Could not open file', err instanceof Error ? err.message : String(err));
    }
  };

  const confirmRemove = (a: AttachmentDto) =>
    Alert.alert('Remove this proof?', a.originalFilename ?? undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(a.id) },
    ]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Proof</Text>
        <Text style={styles.count}>
          {items.length} file{items.length === 1 ? '' : 's'}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ margin: 12 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          <AddTile onPress={() => chooseSource((files) => void add(files))} />
          {uploading.map((u) => (
            <FileTile key={u.file.attachmentId} kind={u.file.kind} uri={u.file.uri} label={u.file.name} progress={u.progress} />
          ))}
          {queued.map((q) => (
            <FileTile key={q.file.attachmentId} kind={q.file.kind} uri={q.file.uri} label={q.file.name} queued />
          ))}
          {items.map((a) => (
            <FileTile
              key={a.id}
              kind={a.kind}
              uri={a.url}
              label={a.originalFilename}
              onPress={() => open(a)}
              onLongPress={() => confirmRemove(a)}
            />
          ))}
        </ScrollView>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>Tap to view · hold to remove</Text>

      <ImageViewerModal attachment={viewer?.attachment ?? null} url={viewer?.url ?? null} onClose={() => setViewer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '600' },
  count: { fontSize: 13, color: '#777' },
  strip: { gap: 10 },
  hint: { fontSize: 11, color: '#999' },
  error: { color: '#C0392B', fontSize: 12 },
});
