import { View } from 'react-native';

import { rupees } from '@/lib/format';
import { CATEGORY_META, color } from '@/lib/theme';
import type { CategorySpend } from '@/lib/types';
import { Amount, Text } from './Text';

/** Stacked bar plus a ranked list. The colour is only a marker: every
 * category is also named, with its amount and share. */
export function CategoryBreakdown({ items }: { items: CategorySpend[] }) {
  return (
    <View style={{ gap: 14 }}>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, backgroundColor: color.ground }}
      >
        {items.map((c) => (
          <View key={c.category} style={{ flex: c.amount, backgroundColor: CATEGORY_META[c.category].color }} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        {items.map((c) => (
          <View
            key={c.category}
            accessible
            accessibilityLabel={`${c.category}, ${rupees(c.amount)}, ${c.percentage.toFixed(1)} percent`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: CATEGORY_META[c.category].color }} />
            <Text variant="label" style={{ flex: 1, fontFamily: 'Inter_400Regular' }}>
              {c.category}
            </Text>
            <Amount style={{ fontSize: 14 }}>{rupees(c.amount)}</Amount>
            <Amount style={{ width: 56, textAlign: 'right', fontSize: 13, color: color.ink2 }}>
              {c.percentage.toFixed(1)}%
            </Amount>
          </View>
        ))}
      </View>
    </View>
  );
}
