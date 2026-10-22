import { View, type ViewProps } from 'react-native';

import { color, radius, space } from '@/lib/theme';

export function Card({ style, padded = true, ...rest }: ViewProps & { padded?: boolean }) {
  return (
    <View
      {...rest}
      style={[{ backgroundColor: color.surface, borderRadius: radius.card, padding: padded ? space.card : 0 }, style]}
    />
  );
}
