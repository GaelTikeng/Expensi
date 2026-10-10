import { ActivityIndicator, Modal, View } from 'react-native';

import { Card } from '@/src/components/ui/card';
import { Progress } from '@/src/components/ui/progress';
import { Text } from '@/src/components/ui/text';
import { useThemeColors } from '@/src/lib/theme';

/** Blocking progress sheet used while the create flow uploads its proofs. */
export function UploadOverlay({ visible, current, total, progress }: { visible: boolean; current: number; total: number; progress: number }) {
  const theme = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/35">
        <Card className="w-[260px] items-center gap-3 p-6">
          <ActivityIndicator color={theme.primary} />
          <Text className="text-[15px]">
            Uploading proof {current} of {total}
          </Text>
          <Progress value={Math.round(progress * 100)} className="h-1.5" indicatorClassName="bg-primary" />
        </Card>
      </View>
    </Modal>
  );
}
