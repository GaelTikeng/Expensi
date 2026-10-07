import { View } from 'react-native';

import { Label } from '@/src/components/ui/label';
import { Text } from '@/src/components/ui/text';
import { cn } from '@/src/lib/utils';

/** Label + control + optional hint or error, with consistent spacing. */
export function FormField({
  label,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {error ? (
        <Text className="text-destructive ml-1 text-xs">{error}</Text>
      ) : hint ? (
        <Text className="text-muted-foreground ml-1 text-xs">{hint}</Text>
      ) : null}
    </View>
  );
}
