import { Platform } from 'react-native';

export interface ThemeColorsType {
  readonly primary: string;
  readonly primaryLight: string;
  readonly background: string;
  readonly card: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly border: string;
  readonly success: string;
  readonly danger: string;
  readonly warning: string;
  readonly info: string;
  readonly accent: string;
  readonly cardElevated: string;
  readonly shadow: string;
  readonly chatUserBubble: string;
  readonly chatUserText: string;
  readonly chatBotBubble: string;
  readonly chatBotBorder: string;
  readonly chatInputBg: string;
  readonly chatChipBg: string;
  readonly chatChipBorder: string;
}

export const Colors = {
  light: {
    primary: '#6366F1', // Premium Indigo
    primaryLight: '#EEF2F6',
    background: '#F8FAFC', // Soft off-white
    card: '#FFFFFF',
    text: '#0F172A', // Slate 900
    textSecondary: '#64748B', // Slate 500
    border: '#E2E8F0', // Slate 200
    success: '#10B981', // Emerald Green
    danger: '#EF4444', // Red
    warning: '#F59E0B', // Amber
    info: '#3B82F6', // Blue
    accent: '#8B5CF6', // Violet
    cardElevated: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.06)',
    chatUserBubble: '#6366F1',
    chatUserText: '#FFFFFF',
    chatBotBubble: '#FFFFFF',
    chatBotBorder: 'rgba(99, 102, 241, 0.12)',
    chatInputBg: '#FFFFFF',
    chatChipBg: '#F1F5F9',
    chatChipBorder: '#E2E8F0',
  },
  dark: {
    primary: '#818CF8', // Bright Indigo
    primaryLight: '#1E1B4B',
    background: '#090D16', // Dark rich obsidian/slate
    card: '#131B2E', // Elevated blue-grey card
    text: '#F8FAFC', // Slate 50
    textSecondary: '#94A3B8', // Slate 400
    border: '#1E293B', // Slate 800
    success: '#34D399', // Mint Green
    danger: '#F87171', // Soft Red
    warning: '#FBBF24', // Yellow
    info: '#60A5FA', // Sky Blue
    accent: '#A78BFA', // Violet Accent
    cardElevated: '#1E293B',
    shadow: 'rgba(0, 0, 0, 0.4)',
    chatUserBubble: '#4F46E5',
    chatUserText: '#FFFFFF',
    chatBotBubble: '#131B2E',
    chatBotBorder: 'rgba(129, 140, 248, 0.2)',
    chatInputBg: '#131B2E',
    chatChipBg: '#1E293B',
    chatChipBorder: 'rgba(129, 140, 248, 0.15)',
  },
} as const;


export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    rounded: 'System',
  },
  default: {
    sans: 'sans-serif',
    rounded: 'sans-serif-condensed',
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
