import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { StateView } from '@/components/StateView';
import { Amount, Text } from '@/components/Text';
import { TransactionRow } from '@/components/TransactionRow';
import { useAppState } from '@/lib/app-state';
import { filterTransactions, type Filter } from '@/lib/filter';
import { addDays, dayLabel, needsReview, rupees } from '@/lib/format';
import { color, font, ICONS } from '@/lib/theme';
import type { Transaction } from '@/lib/types';
import { useRange } from '@/lib/use-data';

const WINDOW_DAYS = 30;

export default function Activity() {
  const { today } = useAppState();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useRange(addDays(today, -(WINDOW_DAYS - 1)), today);

  const reviewCount = data?.filter((t) => t.direction === 'debit' && needsReview(t)).length ?? 0;
  const sections = useMemo(() => {
    const byDay = new Map<string, Transaction[]>();
    for (const t of filterTransactions(data ?? [], filter, query)) {
      const key = t.txn_date ?? 'Undated';
      byDay.set(key, [...(byDay.get(key) ?? []), t]);
    }
    return [...byDay.entries()].map(([day, txns]) => {
      const spend = txns.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
      const income = txns.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
      return { title: day === 'Undated' ? day : dayLabel(day, today), totals: `Spent ${rupees(spend)} · In ${rupees(income)}`, data: txns };
    });
  }, [data, filter, query, today]);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'spend', label: 'Spend' },
    { id: 'income', label: 'Income' },
    { id: 'review', label: `Needs review · ${reviewCount}` },
  ];

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
        <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 4 }}>
          Activity
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            height: 44,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: color.line,
            backgroundColor: color.surface,
          }}
        >
          <Icon path={ICONS.search} size={18} color={color.ink2} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search merchant, UPI ID or amount"
            placeholderTextColor={color.ink2}
            accessibilityLabel="Search payments"
            autoCorrect={false}
            style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: color.ink, paddingVertical: 0 }}
          />
        </View>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {chips.map((c) => {
            const on = c.id === filter;
            const alert = c.id === 'review' && !on;
            return (
              <Pressable
                key={c.id}
                onPress={() => setFilter(c.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{
                  height: 36,
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  borderWidth: on ? 0 : 1,
                  borderColor: alert ? color.alertLine : color.lineStrong,
                  backgroundColor: on ? color.ink : alert ? color.alertSurface : color.surface,
                }}
              >
                <Text variant="label" style={{ color: on ? '#FFFFFF' : alert ? color.alertText : color.ink }}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!data ? (
        <StateView loading={loading} error={error} onRetry={reload} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          stickySectionHeadersEnabled={false}
          onRefresh={reload}
          refreshing={loading}
          ListEmptyComponent={<StateView empty={query || filter !== 'all' ? 'Nothing matches.' : 'No payments in the last 30 days.'} />}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8 }}>
              <Text variant="label" accessibilityRole="header" style={{ fontFamily: font.bodySemi, color: color.ink3 }}>
                {section.title}
              </Text>
              <Amount style={{ fontSize: 13, color: color.ink2 }}>{section.totals}</Amount>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={{
                backgroundColor: color.surface,
                borderTopLeftRadius: index === 0 ? 18 : 0,
                borderTopRightRadius: index === 0 ? 18 : 0,
                borderBottomLeftRadius: index === section.data.length - 1 ? 18 : 0,
                borderBottomRightRadius: index === section.data.length - 1 ? 18 : 0,
                paddingTop: index === 0 ? 4 : 0,
                paddingBottom: index === section.data.length - 1 ? 4 : 0,
              }}
            >
              <TransactionRow
                txn={item}
                onPress={
                  item.direction === 'debit'
                    ? () => router.push({ pathname: '/retag/[id]', params: { id: String(item.id) } })
                    : undefined
                }
              />
            </View>
          )}
        />
      )}
    </View>
  );
}
