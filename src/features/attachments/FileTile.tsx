import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

export const TILE = 84;

/**
 * One square in the attachment strip. Shows a thumbnail for photos, a PDF
 * glyph otherwise, and an optional progress overlay while uploading.
 */
export function FileTile({
  kind,
  uri,
  label,
  progress,
  queued,
  onPress,
  onLongPress,
}: {
  kind: 'photo' | 'pdf';
  /** Local or presigned URI for photos. */
  uri?: string | null;
  label?: string | null;
  /** 0..1 while uploading; undefined when idle. */
  progress?: number;
  /** Parked for retry (offline). */
  queued?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable style={styles.tile} onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      {kind === 'photo' && uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={styles.pdf}>
          <Ionicons name="document-text-outline" size={28} color="#C0392B" />
          <Text style={styles.pdfLabel} numberOfLines={2}>
            {label ?? 'PDF'}
          </Text>
        </View>
      )}
      {progress !== undefined ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.overlayText}>{Math.round(progress * 100)}%</Text>
        </View>
      ) : null}
      {queued ? (
        <View style={[styles.overlay, styles.queued]}>
          <Ionicons name="cloud-offline-outline" size={20} color="#fff" />
          <Text style={styles.overlayText}>Waiting</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function AddTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={[styles.tile, styles.add]} onPress={onPress} accessibilityLabel="Add proof">
      <Ionicons name="add" size={28} color="#1F5EFF" />
      <Text style={styles.addText}>Add</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: TILE, height: TILE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#EEF0F3' },
  image: { width: '100%', height: '100%' },
  pdf: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4 },
  pdfLabel: { fontSize: 10, color: '#555', textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  queued: { backgroundColor: 'rgba(80,80,80,0.6)' },
  overlayText: { color: '#fff', fontSize: 11 },
  add: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#1F5EFF', backgroundColor: '#F4F7FF', alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#1F5EFF', fontSize: 11 },
});
