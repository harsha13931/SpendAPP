import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/lib/app-state';
import { color } from '@/lib/theme';
import { Text } from './Text';

export function Toast() {
  const { toast } = useAppState();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 80,
        padding: 14,
        borderRadius: 14,
        backgroundColor: color.ink,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20 }}>{toast}</Text>
    </View>
  );
}
