import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AttachmentDto } from '@/src/lib/schemas/attachment';

/**
 * Photos open full-screen in-app. PDFs open in the system in-app browser,
 * which renders them natively on both platforms without another dependency.
 */
export async function openAttachment(a: AttachmentDto, url: string, showImage: (a: AttachmentDto, url: string) => void) {
  if (a.kind === 'pdf') {
    await WebBrowser.openBrowserAsync(url);
    return;
  }
  showImage(a, url);
}

export function ImageViewerModal({
  attachment,
  url,
  onClose,
}: {
  attachment: AttachmentDto | null;
  url: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={Boolean(attachment && url)} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.close} onPress={onClose} hitSlop={16} accessibilityLabel="Close">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {url ? <Image source={{ uri: url }} style={styles.image} resizeMode="contain" /> : null}
        {attachment?.originalFilename ? (
          <Text style={styles.caption} numberOfLines={1}>
            {attachment.originalFilename}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  close: { position: 'absolute', top: 56, right: 20, zIndex: 1 },
  image: { width: '100%', height: '80%' },
  caption: { position: 'absolute', bottom: 40, alignSelf: 'center', color: '#ccc', fontSize: 12 },
});
