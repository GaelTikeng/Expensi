import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'nativewind';

/**
 * Raw colour values mirroring the CSS variables in global.css. Use Tailwind
 * classes (`bg-primary`, `text-muted-foreground`) everywhere you can; reach for
 * THEME only where a prop needs a literal colour (ActivityIndicator, icons,
 * navigation chrome). Keep the two files in sync.
 */
export const THEME = {
  light: {
    background: 'hsl(220 20% 97%)',
    foreground: 'hsl(224 20% 10%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(224 20% 10%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(224 20% 10%)',
    primary: 'hsl(223 100% 56%)',
    primaryForeground: 'hsl(0 0% 100%)',
    secondary: 'hsl(220 14% 94%)',
    secondaryForeground: 'hsl(224 20% 10%)',
    muted: 'hsl(220 14% 94%)',
    mutedForeground: 'hsl(220 9% 46%)',
    accent: 'hsl(223 100% 96%)',
    accentForeground: 'hsl(223 100% 40%)',
    destructive: 'hsl(6 63% 46%)',
    success: 'hsl(145 63% 42%)',
    warning: 'hsl(28 80% 52%)',
    border: 'hsl(218 18% 91%)',
    input: 'hsl(220 13% 86%)',
    ring: 'hsl(223 100% 56%)',
    radius: '0.75rem',
  },
  dark: {
    background: 'hsl(224 20% 7%)',
    foreground: 'hsl(220 14% 96%)',
    card: 'hsl(224 18% 11%)',
    cardForeground: 'hsl(220 14% 96%)',
    popover: 'hsl(224 18% 11%)',
    popoverForeground: 'hsl(220 14% 96%)',
    primary: 'hsl(223 100% 64%)',
    primaryForeground: 'hsl(0 0% 100%)',
    secondary: 'hsl(224 14% 17%)',
    secondaryForeground: 'hsl(220 14% 96%)',
    muted: 'hsl(224 14% 17%)',
    mutedForeground: 'hsl(220 9% 65%)',
    accent: 'hsl(223 50% 20%)',
    accentForeground: 'hsl(223 100% 80%)',
    destructive: 'hsl(6 70% 55%)',
    success: 'hsl(145 55% 45%)',
    warning: 'hsl(28 80% 58%)',
    border: 'hsl(224 14% 20%)',
    input: 'hsl(224 14% 24%)',
    ring: 'hsl(223 100% 64%)',
    radius: '0.75rem',
  },
} as const;

/** The raw palette for the current colour scheme (system-driven, F9.5). */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return THEME[colorScheme === 'dark' ? 'dark' : 'light'];
}

/** Headers and the tab bar pick their colours from this via ThemeProvider. */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
