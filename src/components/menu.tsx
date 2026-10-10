import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { cn } from '@/src/lib/utils';

type Tone = 'accent' | 'muted' | 'destructive';

const TILE: Record<Tone, string> = {
  accent: 'bg-accent',
  muted: 'bg-muted',
  destructive: 'bg-destructive/10',
};
const GLYPH: Record<Tone, string> = {
  accent: 'text-accent-foreground',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
};

/**
 * A titled card of navigation rows (E17 account hub). Separators start after
 * the icon tile, like the system settings apps.
 */
export function MenuGroup({ title, footer, children }: { title?: string; footer?: React.ReactNode; children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View className={cn('gap-2', !title && 'mt-8')}>
      {title ? <Text className="ml-1 mt-5 text-[17px] font-bold">{title}</Text> : null}
      <View className="bg-card border-border overflow-hidden rounded-xl border">
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <Separator className="ml-16" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? <Text className="text-muted-foreground ml-1 text-xs">{footer}</Text> : footer}
    </View>
  );
}

/** One row: coloured icon tile, label, optional short value, chevron. Opens its own screen. */
export function MenuRow({
  icon,
  label,
  value,
  onPress,
  tone = 'accent',
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
}) {
  return (
    <Pressable
      className={cn('active:bg-accent min-h-14 flex-row items-center gap-3 px-4 py-2.5', disabled && 'opacity-50')}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className={cn('size-9 items-center justify-center rounded-lg', TILE[tone])}>
        <Icon as={icon} className={cn('size-[18px]', GLYPH[tone])} />
      </View>
      <Text className={cn('flex-1 text-[15px]', tone === 'destructive' && 'text-destructive')} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text className="text-muted-foreground max-w-[45%] text-[13px]" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Icon as={ChevronRight} className="text-muted-foreground size-[18px]" />
    </Pressable>
  );
}
