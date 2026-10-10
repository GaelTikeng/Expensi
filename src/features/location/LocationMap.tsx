import { ExternalLink, MapPin } from 'lucide-react-native';
import { Linking, Pressable, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { mapsUrl, type ExpensePlace } from './capture';

/**
 * E16 F16.3: where the expense was made, as a small static map with a pin.
 * Tapping opens the phone's maps app. The web build resolves
 * LocationMap.web.tsx instead (no native map there).
 */
export function LocationMap({ place }: { place: ExpensePlace }) {
  const region = { latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 };
  return (
    <Pressable
      className="bg-card border-border active:bg-accent gap-2 overflow-hidden rounded-lg border"
      onPress={() => void Linking.openURL(mapsUrl(place))}
      accessibilityRole="button"
      accessibilityLabel="Open in maps"
    >
      <MapView
        style={{ height: 160 }}
        initialRegion={region}
        pointerEvents="none"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        liteMode
      >
        <Marker coordinate={region} />
      </MapView>
      <View className="flex-row items-center gap-2 px-3 pb-3">
        <Icon as={MapPin} className="text-primary size-4" />
        <Text className="flex-1 text-[13px]" numberOfLines={1}>
          {place.locationLabel ?? `${place.latitude}, ${place.longitude}`}
        </Text>
        <Icon as={ExternalLink} className="text-muted-foreground size-4" />
      </View>
    </Pressable>
  );
}
