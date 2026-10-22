import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { Icon } from '@/components/Icon';
import { Amount, Text } from '@/components/Text';
import { useAppState } from '@/lib/app-state';
import { confidenceChip, displayName, rupees } from '@/lib/format';
import { messageFor } from '@/lib/repository';
import { color, font, ICONS } from '@/lib/theme';
import type { CategorizeResponse } from '@/lib/types';

export default function Add() {
  const { repo, bump, remember } = useAppState();
  const insets = useSafeAreaInsets();
  const [sms, setSms] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CategorizeResponse | null>(null);

  async function paste() {
    const text = await Clipboard.getStringAsync();
    if (text) setSms(text);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const out = await repo.categorize(sms.trim());
      setResult(out);
      bump();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  let resultView = null;
  if (result) {
    const t = result.transaction;
    const credit = t.direction === 'credit';
    const view = { ...result.result, merchant: t.merchant, vpa: t.vpa };
    const category = credit ? 'Income' : result.result.category;
    resultView = (
      <Card style={{ gap: 14 }} accessibilityLiveRegion="polite">
        <Text variant="caption">{result.duplicate ? 'Already added earlier' : 'Added'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CategoryIcon category={category} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMedium" numberOfLines={1}>
              {displayName(view)}
            </Text>
            <Text variant="caption">
              {category}
              {t.txn_date ? ` · ${t.txn_date}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Amount style={{ color: credit ? color.income : color.ink }}>{rupees(t.amount, { sign: credit })}</Amount>
            {credit ? null : <ConfidenceChip chip={confidenceChip(result.result)} />}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!credit && result.transaction_id !== null ? (
            <Button
              label="Change category"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                const id = result.transaction_id!;
                // Seed the cache so the sheet can open before lists refetch.
                remember([
                  {
                    id,
                    txn_date: t.txn_date,
                    amount: t.amount,
                    amount_paise: Math.round(t.amount * 100),
                    direction: t.direction,
                    merchant: t.merchant,
                    vpa: t.vpa,
                    account_last4: null,
                    ref_no: null,
                    mode: t.mode,
                    category: result.result.category,
                    confidence: result.result.confidence,
                    layer: result.result.layer,
                    matched: result.result.matched,
                    created_at: '',
                  },
                ]);
                router.replace({ pathname: '/retag/[id]', params: { id: String(id) } });
              }}
            />
          ) : null}
          <Button label="Done" style={{ flex: 1 }} onPress={close} />
        </View>
      </Card>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.ground }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom + 24, gap: 14 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title" accessibilityRole="header">
            Add from SMS
          </Text>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={ICONS.close} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={{ color: color.ink2, lineHeight: 21 }}>
          Copy a bank or UPI alert from your messages and paste it here. SPEND reads the amount, payee and date, then picks a
          category.
        </Text>

        <TextInput
          value={sms}
          onChangeText={(v) => {
            setSms(v);
            setResult(null);
          }}
          multiline
          placeholder="e.g. Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 21/10/26…"
          placeholderTextColor={color.ink2}
          accessibilityLabel="Bank SMS text"
          textAlignVertical="top"
          style={{
            minHeight: 140,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: color.line,
            backgroundColor: color.surface,
            fontFamily: font.body,
            fontSize: 15,
            lineHeight: 21,
            color: color.ink,
          }}
        />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Paste" variant="secondary" style={{ flex: 1 }} onPress={paste} />
          <Button label="Read message" style={{ flex: 2 }} onPress={submit} busy={busy} disabled={!sms.trim()} />
        </View>

        {error ? (
          <View accessibilityLiveRegion="polite" style={{ padding: 14, borderRadius: 14, backgroundColor: color.alertSurface, borderWidth: 1, borderColor: color.alertLine }}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: color.alertText }}>{error}</Text>
          </View>
        ) : null}
        {resultView}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
