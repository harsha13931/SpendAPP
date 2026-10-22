import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useAppState } from '@/lib/app-state';
import { color, font, ICONS } from '@/lib/theme';

interface Source {
  id: 'aa' | 'sms' | 'paste';
  title: string;
  body: string;
  /** Why the option can't be picked yet; undefined when it can. */
  unavailable?: string;
}

const SOURCES: Source[] = [
  {
    id: 'aa',
    title: 'Link bank accounts',
    body: 'Through an RBI-licensed Account Aggregator. You approve each bank and can revoke any time.',
    unavailable: 'Coming soon',
  },
  {
    id: 'sms',
    title: 'Read bank SMS on this phone',
    body: 'Only bank and UPI alerts. OTPs and personal chats are skipped.',
    unavailable: 'Waiting on Google Play approval',
  },
  {
    id: 'paste',
    title: 'Share or paste alerts',
    body: 'Paste a bank SMS into SPEND, and it is read and categorised by your SPEND server.',
  },
];

export default function Onboarding() {
  const { settings, update } = useAppState();
  const insets = useSafeAreaInsets();
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);

  async function start(mode: 'live' | 'sample') {
    await update({ onboarded: true, mode, apiUrl: apiUrl.trim() || settings.apiUrl });
    router.replace('/(tabs)');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.ground }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16, gap: 16, flexGrow: 1 }}
    >
      <Text variant="overline">SPEND</Text>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 28, lineHeight: 34 }}>
          How should SPEND see your payments?
        </Text>
        <Text style={{ color: color.ink2 }}>You can change this later in Privacy.</Text>
      </View>

      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        {SOURCES.map((s) => {
          const selected = s.id === 'paste';
          return (
            <Pressable
              key={s.id}
              disabled={!!s.unavailable}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !!s.unavailable }}
              accessibilityLabel={`${s.title}. ${s.body}${s.unavailable ? `. ${s.unavailable}` : ''}`}
              style={{
                flexDirection: 'row',
                gap: 14,
                padding: 16,
                borderRadius: 16,
                backgroundColor: color.surface,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? color.ink : color.line,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  marginTop: 2,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: s.unavailable ? color.lineStrong : color.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.ink }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: 16, color: s.unavailable ? color.ink2 : color.ink }}>{s.title}</Text>
                <Text style={{ fontSize: 14, lineHeight: 20, color: color.ink2 }}>{s.body}</Text>
                {s.unavailable ? (
                  <Text
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 4,
                      fontFamily: font.bodyMedium,
                      fontSize: 12,
                      color: color.alertTextSoft,
                      backgroundColor: color.alertSurface,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {s.unavailable}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 6 }}>
        <Text variant="label" nativeID="server-label">
          SPEND server address
        </Text>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrl}
          accessibilityLabelledBy="server-label"
          accessibilityLabel="SPEND server address"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{
            height: 48,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: color.line,
            backgroundColor: color.surface,
            fontFamily: font.body,
            fontSize: 15,
            color: color.ink,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 14, backgroundColor: color.infoSurface }}>
        <Icon path={ICONS.shield} color={color.incomeText} />
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: color.incomeText }}>
          SPEND never asks for your bank password, PIN or OTP, and never moves money.
        </Text>
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ gap: 8 }}>
        <Button label="Continue" onPress={() => start('live')} />
        <Button label="Try with sample data" variant="link" onPress={() => start('sample')} />
      </View>
    </ScrollView>
  );
}
