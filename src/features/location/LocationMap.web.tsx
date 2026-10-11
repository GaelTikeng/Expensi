import { ExternalLink, MapPin } from 'lucide-react-native';
import { Linking, Pressable } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { mapsUrl, type ExpensePlace } from './capture';
import { useTranslation } from 'react-i18next';

/** Web has no native map: the place as a link to Google Maps. */
export function LocationMap({ place }: { place: ExpensePlace }) {
  const { t } = useTranslation();
  return (
    <Pressable
      className="bg-card border-border active:bg-accent flex-row items-center gap-2 rounded-lg border p-3"
      onPress={() => void Linking.openURL(mapsUrl(place))}
      accessibilityRole="link"
      accessibilityLabel={t('location.openInMaps')}
    >
      <Icon as={MapPin} className="text-primary size-4" />
      <Text className="flex-1 text-[13px]" numberOfLines={1}>
        {place.locationLabel ?? `${place.latitude}, ${place.longitude}`}
      </Text>
      <Icon as={ExternalLink} className="text-muted-foreground size-4" />
    </Pressable>
  );
}
