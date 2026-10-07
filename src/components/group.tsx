import { Children, Fragment, isValidElement } from 'react';
import { Pressable, View } from 'react-native';

import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { cn } from '@/src/lib/utils';

/**
 * iOS-settings-style grouped list: a rounded card whose children are rows,
 * separated by hairlines. Falsy children are skipped, so conditional rows work.
 */
export function Group({ title, footer, className, children }: { title?: string; footer?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View className={cn('gap-1.5', className)}>
      {title ? <Text className="text-muted-foreground ml-1 mt-3 text-xs uppercase tracking-wide">{title}</Text> : null}
      <View className="bg-card border-border overflow-hidden rounded-lg border">
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <Separator className="ml-4" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? <Text className="text-muted-foreground ml-1 text-xs">{footer}</Text> : footer}
    </View>
  );
}

/** One row in a Group: label on the left, value or control on the right. */
export function GroupRow({
  label,
  description,
  value,
  right,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  description?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const body = (
    <>
      <View className="flex-1 gap-0.5">
        <Text className={cn('text-[15px]', onPress && !destructive && !value && !right && 'text-primary', destructive && 'text-destructive')}>{label}</Text>
        {description ? <Text className="text-muted-foreground text-xs">{description}</Text> : null}
      </View>
      {value !== undefined ? (
        <Text className="text-muted-foreground max-w-[60%] text-[15px]" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
    </>
  );
  const rowClass = cn('min-h-12 flex-row items-center gap-3 px-4 py-3', disabled && 'opacity-50');
  return onPress ? (
    <Pressable className={cn(rowClass, 'active:bg-accent')} onPress={onPress} disabled={disabled}>
      {body}
    </Pressable>
  ) : (
    <View className={rowClass}>{body}</View>
  );
}
