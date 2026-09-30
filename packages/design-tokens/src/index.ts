export const colors = {
  navy950: '#07111F',
  navy900: '#101B2F',
  navy800: '#182741',
  mint600: '#18B985',
  mint500: '#28D8A1',
  mint100: '#DDF9F0',
  sky500: '#38BDF8',
  sand100: '#F4E7D1',
  gold500: '#C99A4A',
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  success: '#22C55E',
  warning: '#F59E0B',
  risky: '#F97316',
  danger: '#EF4444',
  info: '#38BDF8',
} as const;

export const glass = {
  lightSurface: 'rgba(255,255,255,0.90)',
  lightSurfaceStrong: 'rgba(255,255,255,0.97)',
  lightBorder: 'rgba(255,255,255,0.92)',
  softBorder: 'rgba(203,213,225,0.68)',
  darkBorder: 'rgba(255,255,255,0.12)',
  highlight: 'rgba(255,255,255,0.42)',
  darkHighlight: 'rgba(255,255,255,0.08)',
  shadow: 'rgba(7,17,31,0.16)',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
} as const;

export const typography = {
  display: { fontSize: 36, lineHeight: 42, fontWeight: '700' as const },
  heading1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  heading2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  moneyLarge: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const },
  moneyMedium: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
} as const;

export const motion = {
  instant: 0,
  quick: 120,
  standard: 220,
  deliberate: 320,
} as const;

export const touchTarget = 44;

export type JahizColorToken = keyof typeof colors;
