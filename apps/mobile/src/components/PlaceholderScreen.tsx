import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, spacing } from '../theme/tokens';

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.tx, fontFamily: fonts.heading }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.tx3 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});
