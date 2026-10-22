import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { color, font, radius } from '@/lib/theme';
import { Text } from './Text';

interface Props extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'link';
  busy?: boolean;
}

export function Button({ label, variant = 'primary', busy, disabled, style, ...rest }: Props) {
  const primary = variant === 'primary';
  const link = variant === 'link';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      {...rest}
      style={(state) => [
        {
          height: link ? 44 : 52,
          borderRadius: radius.tile,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          backgroundColor: primary ? color.ink : link ? 'transparent' : color.surface,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: color.lineStrong,
          opacity: disabled ? 0.45 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : color.ink} />
      ) : (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: primary ? font.bodySemi : font.bodyMedium,
            fontSize: link ? 15 : 16,
            color: primary ? '#FFFFFF' : link ? color.income : color.ink,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
