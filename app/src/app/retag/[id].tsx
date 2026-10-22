import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useAppState } from '@/lib/app-state';
import { displayName, MODE_LABEL, rupees } from '@/lib/format';
import { messageFor } from '@/lib/repository';
import { CATEGORY_META, color, font, radius } from '@/lib/theme';
import { PICKABLE, type Category } from '@/lib/types';

export default function Retag() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lookup, repo, bump, notify } = useAppState();
  const insets = useSafeAreaInsets();
  const txn = lookup(Number(id));
  const [picked, setPicked] = useState<Category | undefined>(txn?.category);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (!txn) {
    // Deep link or a stale id: nothing cached to edit.
    return (
      <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: color.surface, padding: 24, paddingBottom: insets.bottom + 24, gap: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Text variant="heading">That payment isn’t loaded any more.</Text>
          <Button label="Close" onPress={close} />
        </View>
      </View>
    );
  }

  const name = displayName(txn);

  async function save() {
    if (!txn || !picked) return;
    setBusy(true);
    setError(null);
    try {
      await repo.correct(txn.id, picked, remember);
      bump();
      notify(remember ? `Saved. Every ${name} payment is now ${picked}.` : `Saved for this payment only.`);
      close();
    } catch (e) {
      setError(messageFor(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: color.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 20,
          gap: 16,
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.lineStrong }} />
        <View style={{ gap: 4 }}>
          <Text variant="heading" accessibilityRole="header" style={{ fontSize: 18 }}>
            {name}
          </Text>
          <Text style={{ fontSize: 13, color: color.ink2 }}>
            {rupees(txn.amount)} · {MODE_LABEL[txn.mode] ?? txn.mode}
            {txn.txn_date ? ` · ${txn.txn_date}` : ''}
          </Text>
        </View>

        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {[PICKABLE.slice(0, 4), PICKABLE.slice(4)].map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              {row.map((c) => {
                const on = c === picked;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setPicked(c)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={c}
                    style={{
                      flex: 1,
                      minHeight: 72,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingHorizontal: 2,
                      borderRadius: radius.tile,
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? color.ink : color.line,
                      backgroundColor: on ? CATEGORY_META[c].tint : color.surface,
                    }}
                  >
                    <Icon path={CATEGORY_META[c].icon} />
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.bodyMedium, fontSize: 11 }}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }} nativeID="remember-label">
            Remember this for every payment to {name}
          </Text>
          <Switch
            value={remember}
            onValueChange={setRemember}
            accessibilityLabelledBy="remember-label"
            accessibilityLabel={`Remember this for every payment to ${name}`}
            trackColor={{ true: color.ink, false: color.lineStrong }}
          />
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, color: color.alertText }}>
            {error}
          </Text>
        ) : null}

        <Button label="Save" onPress={save} busy={busy} disabled={!picked} />
      </View>
    </View>
  );
}
