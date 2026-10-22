import { Pressable, View } from 'react-native';

import { confidenceChip, displayName, MODE_LABEL, rupees } from '@/lib/format';
import { color } from '@/lib/theme';
import type { Transaction } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { ConfidenceChip } from './ConfidenceChip';
import { Amount, Text } from './Text';

export function TransactionRow({ txn, onPress }: { txn: Transaction; onPress?: () => void }) {
  const credit = txn.direction === 'credit';
  const category = credit ? 'Income' : txn.category;
  const name = displayName(txn);
  const chip = confidenceChip(txn);
  const amount = rupees(txn.amount, { sign: credit });
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${amount}, ${category}, ${chip.label}`}
      accessibilityHint={onPress ? 'Change category' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 10,
        minHeight: 60,
        backgroundColor: pressed ? color.ground : 'transparent',
      })}
    >
      <CategoryIcon category={category} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption">
          {MODE_LABEL[txn.mode] ?? txn.mode} · {category}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Amount style={{ fontSize: 15, color: credit ? color.income : color.ink }}>{amount}</Amount>
        {credit ? null : <ConfidenceChip chip={chip} />}
      </View>
    </Pressable>
  );
}
