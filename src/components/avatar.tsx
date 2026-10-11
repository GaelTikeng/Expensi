import { Image, View } from 'react-native';

import { Text } from '@/src/components/ui/text';
import { cn } from '@/src/lib/utils';
import { useTranslation } from 'react-i18next';

/** Up to two initials: "Gaël Tikeng" → "GT", "gael@x.com" → "G". */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s@._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/**
 * E15: the user's picture (custom upload first, then the provider's), or
 * their initials on the primary colour when there is none.
 */
export function Avatar({ uri, name, size = 40, className }: { uri?: string | null; name?: string | null; size?: number; className?: string }) {
  const { t } = useTranslation();
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={style} className={cn('bg-muted', className)} accessibilityLabel={name ? t('avatar.photoOf', { name }) : t('avatar.photo')} />;
  }
  return (
    <View style={style} className={cn('bg-primary items-center justify-center', className)} accessibilityLabel={name ? t('avatar.initialsOf', { name }) : t('avatar.profile')}>
      <Text className="text-primary-foreground font-semibold" style={{ fontSize: size * 0.4 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
