import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { Icon } from '@/components/Icon';
import { ReviewBanner } from '@/components/ReviewBanner';
import { StateView } from '@/components/StateView';
import { Text } from '@/components/Text';
import { TransactionRow } from '@/components/TransactionRow';
import { useAppState } from '@/lib/app-state';
import { addDays, dayLabel, displayName, needsReview, rupees } from '@/lib/format';
import { color, ICONS } from '@/lib/theme';
import { useDay } from '@/lib/use-data';

function IconButton({ path, label, onPress, disabled }: { path: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: color.line,
        backgroundColor: pressed ? color.ground : color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Icon path={path} color={color.ink3} strokeWidth={2} />
    </Pressable>
  );
}

export default function Today() {
  const { today, repo } = useAppState();
  const insets = useSafeAreaInsets();
  // The picked day belongs to the "today" it was picked under, so switching
  // between sample and live data snaps back to the new today.
  const [picked, setPicked] = useState({ date: today, today });
  const date = picked.today === today ? picked.date : today;
  const setDate = (d: string) => setPicked({ date: d, today });
  const { data, loading, error, reload } = useDay(date);

  const review = data?.transactions.filter((t) => t.direction === 'debit' && needsReview(t)) ?? [];
  const summary = data?.summary;
  const top = summary?.by_category[0];
  const credits = data?.transactions.filter((t) => t.direction === 'credit').length ?? 0;
  const openRetag = (id: number) => router.push({ pathname: '/retag/[id]', params: { id: String(id) } });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="overline">SPEND{repo.kind === 'sample' ? ' · SAMPLE DATA' : ''}</Text>
          <Text variant="title" accessibilityRole="header">
            {dayLabel(date, today)}
          </Text>
        </View>
        <IconButton path={ICONS.chevronLeft} label="Previous day" onPress={() => setDate(addDays(date, -1))} />
        <IconButton path={ICONS.chevronRight} label="Next day" onPress={() => setDate(addDays(date, 1))} disabled={date >= today} />
        <IconButton path={ICONS.plus} label="Add a payment from an SMS" onPress={() => router.push('/add')} />
      </View>

      {!data ? (
        <Card>
          <StateView loading={loading} error={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, color: color.ink2 }}>Spent {date === today ? 'today' : 'this day'}</Text>
              <Text variant="amountXL">{rupees(summary!.total_spend)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: color.incomeSurface, borderRadius: 14, padding: 12, gap: 2 }}>
                <Text style={{ fontSize: 12, color: color.incomeText }}>Income</Text>
                <Text variant="title" style={{ fontSize: 18, lineHeight: 24, color: color.incomeText }}>
                  {rupees(summary!.total_income)}
                </Text>
                <Text style={{ fontSize: 12, color: color.incomeText }}>
                  {credits === 1 ? '1 credit' : `${credits} credits`}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: color.ground, borderRadius: 14, padding: 12, gap: 2 }}>
                <Text style={{ fontSize: 12, color: color.ink2 }}>Top category</Text>
                <Text variant="heading" numberOfLines={1} style={{ fontSize: 18, lineHeight: 24 }}>
                  {top ? top.category : 'None yet'}
                </Text>
                <Text variant="caption">{top ? `${Math.round(top.percentage)}% of spend` : ' '}</Text>
              </View>
            </View>
          </Card>

          {review.length > 0 ? (
            <ReviewBanner count={review.length} firstName={displayName(review[0])} onPress={() => openRetag(review[0].id)} />
          ) : null}

          {summary!.by_category.length > 0 ? (
            <Card style={{ gap: 14 }}>
              <Text variant="heading" accessibilityRole="header">
                Where it went
              </Text>
              <CategoryBreakdown items={summary!.by_category} />
            </Card>
          ) : null}

          <Card padded={false} style={{ paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }}>
              <Text variant="heading" accessibilityRole="header">
                Transactions
              </Text>
              <Pressable onPress={() => router.navigate('/activity')} accessibilityRole="link" style={{ paddingVertical: 12 }}>
                <Text variant="label" style={{ color: color.income }}>
                  See all
                </Text>
              </Pressable>
            </View>
            {data.transactions.length === 0 ? (
              <StateView empty="No payments on this day." />
            ) : (
              data.transactions.map((t) => (
                // Credits always count as income, so only debits can be re-tagged.
                <TransactionRow key={t.id} txn={t} onPress={t.direction === 'debit' ? () => openRetag(t.id) : undefined} />
              ))
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
