import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useAppState } from '@/lib/app-state';
import { color, font } from '@/lib/theme';

function Row({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="bodyMedium">{title}</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: color.ink2 }}>{body}</Text>
    </View>
  );
}

export default function Privacy() {
  const { settings, update, reset, notify } = useAppState();
  const insets = useSafeAreaInsets();
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const live = settings.mode === 'live';

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
      <Text variant="title" accessibilityRole="header" style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
        Privacy
      </Text>

      <Card style={{ gap: 14 }}>
        <Text variant="heading" accessibilityRole="header">
          What SPEND does with your data
        </Text>
        <Row title="Never asks for credentials" body="No bank password, PIN or OTP, ever. SPEND cannot move money." />
        <Row title="Only payment alerts" body="OTPs, offers, reminders and failed payments are ignored." />
        <Row
          title="Your corrections stay yours"
          body="When you re-tag a payment, the rule is saved for your account only."
        />
      </Card>

      <Card style={{ gap: 14 }}>
        <Text variant="heading" accessibilityRole="header">
          Data source
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: color.ink2 }}>
          {live
            ? `Connected to your SPEND server. Account ID ${settings.userId}.`
            : 'Showing fictional sample data. Nothing is sent anywhere.'}
        </Text>
        <View style={{ gap: 6 }}>
          <Text variant="label" nativeID="privacy-server-label">
            SPEND server address
          </Text>
          <TextInput
            value={apiUrl}
            onChangeText={setApiUrl}
            accessibilityLabel="SPEND server address"
            accessibilityLabelledBy="privacy-server-label"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={{
              height: 48,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: color.line,
              fontFamily: font.body,
              fontSize: 15,
              color: color.ink,
            }}
          />
        </View>
        {live ? (
          <View style={{ gap: 8 }}>
            <Button
              label="Save address"
              variant="secondary"
              disabled={apiUrl.trim() === settings.apiUrl}
              onPress={async () => {
                await update({ apiUrl: apiUrl.trim() });
                notify('Server address saved.');
              }}
            />
            <Button label="Switch to sample data" variant="link" onPress={() => update({ mode: 'sample' })} />
          </View>
        ) : (
          <Button label="Connect to server" onPress={() => update({ mode: 'live', apiUrl: apiUrl.trim() || settings.apiUrl })} />
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text variant="heading" accessibilityRole="header">
          Coming next
        </Text>
        <Row title="Link bank accounts" body="Through an RBI-licensed Account Aggregator, on Android and iPhone." />
        <Row title="Read bank SMS" body="Only if Google Play approves SMS access for SPEND." />
        <Row title="Share from Messages" body="Send a bank SMS to SPEND from your messaging app." />
      </Card>

      <Button
        label="Reset app"
        variant="link"
        onPress={async () => {
          await reset();
          router.replace('/onboarding');
        }}
      />
    </ScrollView>
  );
}
