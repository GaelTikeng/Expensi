import { ActionSheetProvider, useActionSheet } from '@expo/react-native-action-sheet';
import { BlurView } from 'expo-blur';
import { cssInterop, useColorScheme } from 'nativewind';
import { createContext, Fragment, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Separator } from '@/src/components/ui/separator';
import { Text } from '@/src/components/ui/text';
import { useThemeColors } from '@/src/lib/theme';
import { cn } from '@/src/lib/utils';

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void | Promise<void>;
}

interface SheetRequest {
  title?: string;
  message?: string;
  options: string[];
  destructive: number[];
  cancelLabel: string;
  /** Index into `options`, or null when dismissed. */
  onSelect: (index: number | null) => void;
}

/**
 * NativeWindUI's Action Sheet pattern (https://nativewindui.com/component/action-sheet).
 * iOS shows the system sheet through `@expo/react-native-action-sheet`, which
 * already blurs what is behind it. Android and web get our own sheet with a
 * blurred, dimmed backdrop so the choice is what the eye lands on. Use it for
 * every choice made in place (delete, skip, pick a source); plain messages
 * stay as alerts.
 */
const SheetContext = createContext<(req: SheetRequest) => void>(() => undefined);

// Third-party component: let NativeWind resolve `className` on it.
cssInterop(BlurView, { className: 'style' });

export function ActionSheetHost({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<SheetRequest | null>(null);
  const open = useCallback((req: SheetRequest) => setCurrent(req), []);
  const finish = (index: number | null) => {
    const req = current;
    setCurrent(null);
    req?.onSelect(index);
  };
  return (
    <ActionSheetProvider>
      <SheetContext.Provider value={open}>
        {children}
        {current ? <BlurredSheet request={current} onFinish={finish} /> : null}
      </SheetContext.Provider>
    </ActionSheetProvider>
  );
}

function BlurredSheet({ request, onFinish }: { request: SheetRequest; onFinish: (index: number | null) => void }) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    // A Modal so the sheet stacks above any other modal that opened it.
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={() => onFinish(null)}>
      <BlurView
        intensity={isDark ? 40 : 30}
        tint={isDark ? 'dark' : 'light'}
        blurMethod="dimezisBlurView"
        className="flex-1 justify-end"
      >
        <Pressable className="absolute inset-0 bg-black/40" onPress={() => onFinish(null)} accessibilityLabel="Dismiss" />
        <Animated.View entering={SlideInDown.duration(220)} className="gap-2 px-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="bg-card overflow-hidden rounded-2xl">
            {request.title || request.message ? (
              <>
                <View className="items-center gap-1 px-4 py-3.5">
                  {request.title ? <Text className="text-muted-foreground text-center text-[13px] font-semibold">{request.title}</Text> : null}
                  {request.message ? <Text className="text-muted-foreground text-center text-[13px]">{request.message}</Text> : null}
                </View>
                <Separator />
              </>
            ) : null}
            {request.options.map((label, i) => (
              <Fragment key={`${i}-${label}`}>
                {i > 0 ? <Separator /> : null}
                <Pressable className="active:bg-accent items-center py-4" onPress={() => onFinish(i)} accessibilityRole="button">
                  <Text className={cn('text-[17px]', request.destructive.includes(i) ? 'text-destructive' : 'text-primary')}>{label}</Text>
                </Pressable>
              </Fragment>
            ))}
          </View>
          <Pressable className="bg-card active:bg-accent items-center rounded-2xl py-4" onPress={() => onFinish(null)} accessibilityRole="button">
            <Text className="text-primary text-[17px] font-semibold">{request.cancelLabel}</Text>
          </Pressable>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

export function useActionSheets() {
  const native = useActionSheet();
  const openBlurred = useContext(SheetContext);
  const theme = useThemeColors();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const present = useCallback(
    (req: SheetRequest) => {
      if (Platform.OS !== 'ios') return openBlurred(req);
      const options = [...req.options, req.cancelLabel];
      const cancelButtonIndex = options.length - 1;
      native.showActionSheetWithOptions(
        {
          title: req.title,
          message: req.message,
          options,
          cancelButtonIndex,
          destructiveButtonIndex: req.destructive.length ? req.destructive : undefined,
          userInterfaceStyle: isDark ? 'dark' : 'light',
          containerStyle: { backgroundColor: theme.card },
          textStyle: { color: theme.foreground },
          titleTextStyle: { color: theme.mutedForeground },
          messageTextStyle: { color: theme.mutedForeground },
          destructiveColor: theme.destructive,
        },
        (index) => req.onSelect(index === undefined || index === cancelButtonIndex ? null : index),
      );
    },
    [native, openBlurred, theme, isDark],
  );

  const show = useCallback(
    (opts: { title?: string; message?: string; actions: SheetAction[]; cancelLabel?: string }) =>
      present({
        title: opts.title,
        message: opts.message,
        options: opts.actions.map((a) => a.label),
        destructive: opts.actions.flatMap((a, i) => (a.destructive ? [i] : [])),
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        onSelect: (i) => {
          if (i !== null) void opts.actions[i]?.onPress();
        },
      }),
    [present],
  );

  /** One decision: resolves true when the user picks the action, false on cancel. */
  const confirm = useCallback(
    (opts: { title: string; message?: string; actionLabel: string; destructive?: boolean }) =>
      new Promise<boolean>((resolve) =>
        present({
          title: opts.title,
          message: opts.message,
          options: [opts.actionLabel],
          destructive: opts.destructive === false ? [] : [0],
          cancelLabel: 'Cancel',
          onSelect: (i) => resolve(i === 0),
        }),
      ),
    [present],
  );

  return useMemo(() => ({ show, confirm }), [show, confirm]);
}
