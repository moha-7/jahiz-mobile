export type TripCostVisual = {
  accent: string;
  surface: string;
  border: string;
};

const DARK_ALPHA = '0.11';
const LIGHT_ALPHA = '0.075';

function makeVisual(
  rgb: string,
  accent: string,
  isDark: boolean,
): TripCostVisual {
  return {
    accent,
    surface: `rgba(${rgb},${
      isDark
        ? DARK_ALPHA
        : LIGHT_ALPHA
    })`,
    border: `rgba(${rgb},0.24)`,
  };
}

export function tripCostVisualFor(
  categoryId: string,
  isDark: boolean,
): TripCostVisual {
  switch (categoryId) {
    case 'cat-flight':
      return makeVisual(
        '69,184,245',
        '#45B8F5',
        isDark,
      );
    case 'cat-accommodation':
      return makeVisual(
        '167,139,250',
        '#A78BFA',
        isDark,
      );
    case 'cat-visa':
      return makeVisual(
        '48,214,162',
        '#30D6A2',
        isDark,
      );
    case 'cat-car':
      return makeVisual(
        '245,185,76',
        '#F5B94C',
        isDark,
      );
    case 'cat-insurance':
      return makeVisual(
        '45,212,191',
        '#2DD4BF',
        isDark,
      );
    case 'cat-activities':
      return makeVisual(
        '251,113,133',
        '#FB7185',
        isDark,
      );
    case 'cat-transport':
      return makeVisual(
        '34,211,238',
        '#22D3EE',
        isDark,
      );
    case 'cat-food':
      return makeVisual(
        '251,146,60',
        '#FB923C',
        isDark,
      );
    case 'cat-shopping':
      return makeVisual(
        '232,121,249',
        '#E879F9',
        isDark,
      );
    case 'cat-emergency':
      return makeVisual(
        '248,113,113',
        '#F87171',
        isDark,
      );
    default:
      return makeVisual(
        '148,163,184',
        '#94A3B8',
        isDark,
      );
  }
}
