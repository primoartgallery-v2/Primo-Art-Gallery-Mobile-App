/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Backgrounds
    background: "#FAF8F5",
    backgroundElement: "#F0EBE1",
    backgroundSelected: "#E8DEC8",
    card: "#FFFFFF",
    cardAlt: "#F9F6F0",
    surface: "#FFFFFF",
    input: "#FFFFFF",
    modalOverlay: "rgba(18, 18, 18, 0.6)",

    // Texts
    text: "#17202A",
    textSecondary: "#6A675F",
    textMuted: "#969288",
    textInverted: "#FFFFFF",

    // Borders & Lines
    border: "#E8E2D8",
    borderLight: "#F2ECE2",
    borderFocus: "#B8964E",

    // Gold Accents
    gold: "#B8964E",
    goldDeep: "#9A7B38",
    goldLight: "#D4AF37",
    goldSoft: "#F8F0DC",
    goldBadge: "#F3EAD7",
    goldBadgeText: "#6D5421",

    // Status Colors
    success: "#3B7A57",
    successSoft: "#EAF5EF",
    danger: "#C84B31",
    dangerSoft: "#FDEEEC",

    // Navigation & Header
    navBackground: "#FFFFFF",
    navBorder: "#E8E2D8",
    navActive: "#B8964E",
    navInactive: "#817D75",
    navActivePill: "#F7EEDB",
    headerBackground: "#FAF8F5",
    statusBar: "dark-content" as const,
  },
  dark: {
    // Backgrounds
    background: "#0D0E12",
    backgroundElement: "#181920",
    backgroundSelected: "#2A2619",
    card: "#16171E",
    cardAlt: "#1C1D26",
    surface: "#16171E",
    input: "#1A1B23",
    modalOverlay: "rgba(0, 0, 0, 0.75)",

    // Texts
    text: "#F5F6F8",
    textSecondary: "#A0A4B0",
    textMuted: "#6D7180",
    textInverted: "#0D0E12",

    // Borders & Lines
    border: "#272935",
    borderLight: "#1F202A",
    borderFocus: "#D4AF37",

    // Gold Accents
    gold: "#D4AF37",
    goldDeep: "#E5C365",
    goldLight: "#F0D78C",
    goldSoft: "#2A2417",
    goldBadge: "#282315",
    goldBadgeText: "#E5C365",

    // Status Colors
    success: "#4ADE80",
    successSoft: "#132D1E",
    danger: "#F87171",
    dangerSoft: "#361616",

    // Navigation & Header
    navBackground: "#131419",
    navBorder: "#22242E",
    navActive: "#D4AF37",
    navInactive: "#737785",
    navActivePill: "#2A2417",
    headerBackground: "#0D0E12",
    statusBar: "light-content" as const,
  },
};

export type ThemeColors = {
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  card: string;
  cardAlt: string;
  surface: string;
  input: string;
  modalOverlay: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textInverted: string;

  border: string;
  borderLight: string;
  borderFocus: string;

  gold: string;
  goldDeep: string;
  goldLight: string;
  goldSoft: string;
  goldBadge: string;
  goldBadgeText: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;

  navBackground: string;
  navBorder: string;
  navActive: string;
  navInactive: string;
  navActivePill: string;
  headerBackground: string;
  statusBar: "light-content" | "dark-content";
};

export type ThemeColor = keyof ThemeColors;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
