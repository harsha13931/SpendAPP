import { Pressable, View } from 'react-native';

import { color, font, ICONS } from '@/lib/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export function ReviewBanner({ count, firstName, onPress }: { count: number; firstName: string; onPress: () => void }) {
  const title = count === 1 ? '1 payment needs a category' : `${count} payments need a category`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${firstName} didn’t match anything we know.`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color.alertLine,
        backgroundColor: pressed ? '#FFE9DA' : color.alertSurface,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.alert, alignItems: 'center', justifyContent: 'center' }}>
        <Icon path={ICONS.alert} size={18} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.bodySemi, fontSize: 15, color: color.alertText }}>{title}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: color.alertTextSoft }}>
          {firstName} didn’t match anything we know
        </Text>
      </View>
      <Icon path={ICONS.chevronRight} size={18} color={color.alertText} strokeWidth={2} />
    </Pressable>
  );
}
