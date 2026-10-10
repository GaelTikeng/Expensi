import * as WebBrowser from 'expo-web-browser';
import { X } from 'lucide-react-native';
import { Image, Modal, Pressable, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
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
      <View className="flex-1 justify-center bg-black">
        <Pressable className="absolute right-5 top-14 z-10" onPress={onClose} hitSlop={16} accessibilityLabel="Close">
          <Icon as={X} className="size-7 text-white" />
        </Pressable>
        {url ? <Image source={{ uri: url }} className="h-[80%] w-full" resizeMode="contain" /> : null}
        {attachment?.originalFilename ? (
          <Text className="absolute bottom-10 self-center text-xs text-white/80" numberOfLines={1}>
            {attachment.originalFilename}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
