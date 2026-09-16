import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style }: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.acFg : colors.ac} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              {
                color: variant === 'primary' ? colors.acFg : variant === 'destructive' ? colors.danger : colors.tx,
                fontFamily: fonts.bodyMedium,
              },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 14, stiffness: 260 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 14, stiffness: 260 }))}
        style={[animatedStyle, isDisabled && styles.disabled]}
      >
        <LinearGradient
          colors={colors.acGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, styles.primaryShadow, style]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const isDestructive = variant === 'destructive';
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 14, stiffness: 260 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 14, stiffness: 260 }))}
      style={[
        animatedStyle,
        styles.base,
        {
          backgroundColor: isDestructive ? colors.dangerBg : 'rgba(255, 255, 255, 0.06)',
          borderColor: isDestructive ? colors.dangerLine : colors.line2,
          borderWidth: 1,
        },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  primaryShadow: {
    shadowColor: '#38b6ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  label: {
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});
