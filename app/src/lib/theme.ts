import type { Category } from './types';

// Tokens from the design canvas (design/project/System.dc.html).
export const color = {
  ink: '#101828',
  ink2: '#475467',
  ink3: '#344054',
  ground: '#F2F4F7',
  surface: '#FFFFFF',
  line: '#E4E7EC',
  lineStrong: '#D0D5DD',
  income: '#175CD3',
  incomeText: '#1849A9',
  incomeSurface: '#EFF4FF',
  alert: '#C4320A',
  alertText: '#97180C',
  alertTextSoft: '#7A2E0E',
  alertSurface: '#FFF4ED',
  alertLine: '#F9C9A8',
  infoSurface: '#E7EDF8',
  scrim: 'rgba(16, 24, 40, 0.48)',
} as const;

export const font = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  display: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
} as const;

export const radius = { card: 20, tile: 14, chip: 10 } as const;
export const space = { gutter: 16, card: 20 } as const;

export interface CategoryMeta {
  color: string;
  tint: string;
  /** One SVG path, 24×24 viewBox, stroked. */
  icon: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  Food: { color: '#E8590C', tint: '#FFF4E6', icon: 'M7 3v7a2 2 0 0 0 2 2v9 M11 3v7 M17 21V3c-2 1-3 3-3 6s1 4 3 4' },
  Groceries: { color: '#2F9E44', tint: '#EBFBEE', icon: 'M3 4h2l2.4 11h11.1L21 7H6 M8 20a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0 M15.5 20a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0' },
  Transport: { color: '#1C7ED6', tint: '#E7F5FF', icon: 'M5 17v-6l2-5h10l2 5v6z M5 17v2 M19 17v2 M5 11h14' },
  Shopping: { color: '#AE3EC9', tint: '#F8F0FC', icon: 'M5 8h14l-1 13H6z M9 8V6a3 3 0 0 1 6 0v2' },
  Bills: { color: '#F59F00', tint: '#FFF9DB', icon: 'M13 2L4 14h7l-1 8 9-12h-7z' },
  Entertainment: { color: '#D6336C', tint: '#FFF0F6', icon: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M10 9l5 3-5 3z' },
  Health: { color: '#0CA678', tint: '#E6FCF5', icon: 'M12 20s-7-4.4-9-9.2C1.8 7.6 4 4.5 7.3 4.5c2 0 3.6 1 4.7 2.6 1.1-1.6 2.7-2.6 4.7-2.6 3.3 0 5.5 3.1 4.3 6.3C19 15.6 12 20 12 20z' },
  Income: { color: '#175CD3', tint: '#EFF4FF', icon: 'M12 4v11 M7 10l5 5 5-5 M4 20h16' },
  Other: { color: '#868E96', tint: '#F1F3F5', icon: 'M5 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M17 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0' },
};

export const ICONS = {
  home: 'M4 20V10l8-6 8 6v10z M10 20v-6h4v6',
  list: 'M4 6h16 M4 12h16 M4 18h10',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z M9 12l2 2 4-4',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z M16 16l5 5',
  alert: 'M12 7v6 M12 17h.01',
  close: 'M6 6l12 12 M18 6L6 18',
  clipboard: 'M9 4h6v3H9z M7 5H5v16h14V5h-2',
} as const;
