import { Check } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** A "pick one" screen body: a card of options with a check on the current one (E17). */
export function ChoiceList<T extends string>({
  options,
  value,
  onSelect,
  footer,
}: {
  options: Choice<T>[];
  value: T | undefined;
  onSelect: (value: T) => void;
  footer?: string;
}) {
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-2 p-4 pb-12">
      <View className="bg-card border-border overflow-hidden rounded-xl border">
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <Fragment key={o.value}>
              {i > 0 ? <Separator className="ml-4" /> : null}
              <Pressable
                className="active:bg-accent min-h-12 flex-row items-center gap-3 px-4 py-3"
                onPress={() => onSelect(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={o.label}
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px]">{o.label}</Text>
                  {o.description ? <Text className="text-muted-foreground text-xs">{o.description}</Text> : null}
                </View>
                {selected ? <Icon as={Check} className="text-primary size-5" /> : null}
              </Pressable>
            </Fragment>
          );
        })}
      </View>
      {footer ? <Text className="text-muted-foreground ml-1 text-xs">{footer}</Text> : null}
    </ScrollView>
  );
}
