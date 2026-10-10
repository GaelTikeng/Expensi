import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/src/lib/utils';

/**
 * Root of a tab screen. The tabs hide the navigation header, so the status
 * bar inset is applied here instead. Inline style because the inset is a
 * runtime value (0 on web and on devices without a notch).
 */
export function TabScreen({ className, children }: { className?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className={cn('bg-background flex-1', className)} style={{ paddingTop: insets.top }}>
      {children}
    </View>
  );
}
