import { Tabs } from 'expo-router/js-tabs';

import { Icon } from '@/components/Icon';
import { color, font, ICONS } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.ink2,
        tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 16 },
        // Inter's line height needs more room than the default 49 px bar.
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line, minHeight: 60 },
        sceneStyle: { backgroundColor: color.ground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color: c }) => <Icon path={ICONS.home} size={22} color={c} /> }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: ({ color: c }) => <Icon path={ICONS.list} size={22} color={c} /> }}
      />
      <Tabs.Screen
        name="privacy"
        options={{ title: 'Privacy', tabBarIcon: ({ color: c }) => <Icon path={ICONS.shield} size={22} color={c} /> }}
      />
    </Tabs>
  );
}
