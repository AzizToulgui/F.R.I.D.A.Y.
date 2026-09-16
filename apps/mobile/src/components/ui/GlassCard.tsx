import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeProvider';
import { blur, radius } from '../../theme/tokens';

export type GlassTier = 1 | 2 | 3;

interface GlassCardProps {
  children: ReactNode;
  tier?: GlassTier;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

// Tier 1: flat surface canvas (no blur, used for full-screen backgrounds).
// Tier 2: standard glass container - message cards, list rows, most screen content.
// Tier 3: floating command dock / prompt bar - stronger blur + accent-tinted border.
//
// `style` is merged onto the single outer/content View (same convention as a plain styled
// View elsewhere in the app) so callers can pass flexDirection/padding/gap/width and have it
// apply to the actual content layout, not just outer sizing. The BlurView is an absolutely
// positioned first child clipped by this View's own overflow:hidden + borderRadius - it does
// not participate in the children's flex layout.
export function GlassCard({ children, tier = 2, style, borderRadius = radius.xl }: GlassCardProps) {
  const { colors, mode } = useTheme();

  if (tier === 1) {
    return <View style={[{ backgroundColor: colors.bg2, borderRadius }, style]}>{children}</View>;
  }

  const isTier3 = tier === 3;
  return (
    <View
      style={[
        styles.base,
        {
          borderRadius,
          backgroundColor: isTier3 ? colors.glassFillStrong : colors.glassFill,
          borderColor: isTier3 ? colors.glassBorderStrong : colors.glassBorder,
        },
        style,
      ]}
    >
      <BlurView
        intensity={isTier3 ? blur.dock : blur.card}
        tint={mode === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
