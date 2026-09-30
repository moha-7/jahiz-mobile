export const product = {
  name: 'Jahiz',
  nameArabic: 'جاهز',
  tagline: 'Know before you go',
  taglineArabic: 'اعرف قبل ما تسافر',
  apiVersion: 'v1',
} as const;

export const supportedLocales = ['en', 'ar'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
