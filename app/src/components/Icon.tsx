import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { color as palette } from '@/lib/theme';

interface Props {
  path: string;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
}

/** Stroked line icon. Decorative: pair it with visible text or an
 * accessibilityLabel on the pressable that contains it. */
export function Icon({ path, size = 20, color = palette.ink, strokeWidth = 1.8 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d={path} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
