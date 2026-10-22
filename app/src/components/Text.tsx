import { Text as RNText, type TextProps } from 'react-native';

import { color, font } from '@/lib/theme';

type Variant = 'amountXL' | 'title' | 'heading' | 'body' | 'bodyMedium' | 'label' | 'caption' | 'overline';

const STYLES: Record<Variant, object> = {
  amountXL: { fontFamily: font.display, fontSize: 40, lineHeight: 44, color: color.ink, fontVariant: ['tabular-nums'] },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 30, color: color.ink },
  heading: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 22, color: color.ink },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: color.ink },
  bodyMedium: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 21, color: color.ink },
  label: { fontFamily: font.bodyMedium, fontSize: 14, lineHeight: 20, color: color.ink },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 16, color: color.ink2 },
  overline: { fontFamily: font.bodySemi, fontSize: 13, letterSpacing: 1.5, color: color.ink2 },
};

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText {...rest} style={[STYLES[variant], style]} />;
}

/** Tabular figures in the display face, for amounts in lists. */
export function Amount({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[{ fontFamily: font.display, fontSize: 15, color: color.ink, fontVariant: ['tabular-nums'] }, style]} />;
}
