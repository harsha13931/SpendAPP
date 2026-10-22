import { Redirect } from 'expo-router';

import { useAppState } from '@/lib/app-state';

export default function Index() {
  const { settings } = useAppState();
  return <Redirect href={settings.onboarded ? '/(tabs)' : '/onboarding'} />;
}
