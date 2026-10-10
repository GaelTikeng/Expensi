import { cn } from '@/src/lib/utils';
import { View } from 'react-native';

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  // bg-border rather than the registry's bg-accent: our accent is a blue tint,
  // and the page background is grey, so a neutral one step darker reads on both.
  return <View className={cn('bg-border animate-pulse rounded-md', className)} {...props} />;
}

export { Skeleton };
