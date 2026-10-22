import { View } from 'react-native';

import { CATEGORY_META } from '@/lib/theme';
import type { Category } from '@/lib/types';
import { Icon } from './Icon';

export function CategoryIcon({ category, size = 40 }: { category: Category; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: CATEGORY_META[category].tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon path={CATEGORY_META[category].icon} size={size * 0.45} />
    </View>
  );
}
