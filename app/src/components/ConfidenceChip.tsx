import { View } from 'react-native';

import type { Chip } from '@/lib/format';
import { color, font } from '@/lib/theme';
import { Text } from './Text';

const TONES = {
  quiet: { fg: color.ink2, bg: 'transparent' },
  neutral: { fg: color.ink3, bg: color.ground },
  alert: { fg: color.alertText, bg: color.alertSurface },
} as const;

export function ConfidenceChip({ chip }: { chip: Chip }) {
  const tone = TONES[chip.tone];
  return (
    <View style={{ backgroundColor: tone.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontFamily: font.bodyMedium, fontSize: 11, lineHeight: 15, color: tone.fg }}>{chip.label}</Text>
    </View>
  );
}
