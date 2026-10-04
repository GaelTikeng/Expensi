import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

/** Blocking progress sheet used while the create flow uploads its proofs. */
export function UploadOverlay({ visible, current, total, progress }: { visible: boolean; current: number; total: number; progress: number }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator />
          <Text style={styles.title}>
            Uploading proof {current} of {total}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 24, width: 260, alignItems: 'center', gap: 12 },
  title: { fontSize: 15 },
  bar: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#EEF0F3', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1F5EFF' },
});
