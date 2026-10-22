import { ActivityIndicator, View } from 'react-native';

import { color } from '@/lib/theme';
import { Button } from './Button';
import { Text } from './Text';

/** Loading, error and empty states for a data-backed section. */
export function StateView({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View style={{ padding: 32, alignItems: 'center' }}>
        <ActivityIndicator color={color.ink2} accessibilityLabel="Loading" />
      </View>
    );
  }
  return (
    <View style={{ padding: 24, alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
      <Text variant="body" style={{ color: color.ink2, textAlign: 'center' }}>
        {error ?? empty}
      </Text>
      {error && onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
