import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { labelStatusStyle, radius, spacing } from '../../theme/tokens';

export type StatusTone = 'ok' | 'active' | 'synthesis' | 'danger' | 'neutral';

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
}

// Small bordered pill with a pulsating-in-spirit LED dot, per DESIGN.md's telemetry chip
// component. Tone maps to the accent that best communicates the state: green for healthy/
// low-latency, azure for active synthesis, violet for multimodal reasoning, red for errors.
export function StatusChip({ label, tone = 'neutral', style }: StatusChipProps) {
  const { colors } = useTheme();

  const dotColor =
    tone === 'ok'
      ? colors.ok
      : tone === 'active'
        ? colors.ac
        : tone === 'synthesis'
          ? colors.ac3
          : tone === 'danger'
            ? colors.danger
            : colors.tx4;

  return (
    <View style={[styles.chip, { borderColor: colors.line2, backgroundColor: 'rgba(255, 255, 255, 0.04)' }, style]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[labelStatusStyle, { color: colors.tx3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    height: 5,
    width: 5,
    borderRadius: 2.5,
  },
});
