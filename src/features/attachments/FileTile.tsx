import { CloudOff, FileText, Plus } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

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
    <Pressable className="bg-muted size-[84px] overflow-hidden rounded-md" onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      {kind === 'photo' && uri ? (
        <Image source={{ uri }} className="size-full" />
      ) : (
        <View className="flex-1 items-center justify-center gap-1 p-1.5">
          <Icon as={FileText} className="text-destructive size-7" />
          <Text className="text-muted-foreground text-center text-[10px]" numberOfLines={2}>
            {label ?? 'PDF'}
          </Text>
        </View>
      )}
      {progress !== undefined ? (
        <View className="absolute inset-0 items-center justify-center gap-1 bg-black/45">
          <ActivityIndicator color="#fff" />
          <Text className="text-[11px] text-white">{Math.round(progress * 100)}%</Text>
        </View>
      ) : null}
      {queued ? (
        <View className="absolute inset-0 items-center justify-center gap-1 bg-black/55">
          <Icon as={CloudOff} className="size-5 text-white" />
          <Text className="text-[11px] text-white">Waiting</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function AddTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      className="border-primary bg-accent size-[84px] items-center justify-center rounded-md border border-dashed active:opacity-80"
      onPress={onPress}
      accessibilityLabel="Add proof"
    >
      <Icon as={Plus} className="text-primary size-7" />
      <Text className="text-primary text-[11px]">Add</Text>
    </Pressable>
  );
}
