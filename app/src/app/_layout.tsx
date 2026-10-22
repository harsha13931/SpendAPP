import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { Toast } from '@/components/Toast';
import { AppStateProvider, useAppState } from '@/lib/app-state';
import { color } from '@/lib/theme';

function Shell() {
  const { ready } = useAppState();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  // A font that fails to load falls back to the system face; never block on it.
  if (!ready || (!fontsLoaded && !fontError)) return <View style={{ flex: 1, backgroundColor: color.ground }} />;

  return (
    <View style={{ flex: 1, backgroundColor: color.ground }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="retag/[id]"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      </Stack>
      <Toast />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
