import { Check, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { cn } from '@/src/lib/utils';

export interface Option {
  value: string;
  label: string;
}

/**
 * A row that opens a full-screen list. Kept as a full screen rather than the
 * Select dropdown because some lists (timezones, currencies) are long.
 */
export function OptionPicker({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <>
      <Pressable
        className={cn('min-h-12 flex-row items-center gap-3 px-4 py-3 active:bg-accent', disabled && 'opacity-50')}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}`}
      >
        <Text className="flex-1 text-[15px]">{label}</Text>
        <Text className="text-muted-foreground max-w-[60%] text-[15px]" numberOfLines={1}>
          {current}
        </Text>
        <Icon as={ChevronRight} className="text-muted-foreground size-4" />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
          <View className="border-border flex-row items-center justify-between border-b px-4 pb-3 pt-2">
            <Text variant="large">{label}</Text>
            <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
              <Text>Done</Text>
            </Button>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            ItemSeparatorComponent={() => <Separator className="ml-4" />}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  className="flex-row items-center justify-between px-4 py-4 active:bg-accent"
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text className={cn('text-base', selected && 'text-primary font-semibold')}>{item.label}</Text>
                  {selected ? <Icon as={Check} className="text-primary size-5" /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}
