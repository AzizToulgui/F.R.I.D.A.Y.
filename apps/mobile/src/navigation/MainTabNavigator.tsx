import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Brain, House, Mic, Settings as SettingsIcon, Wrench } from 'lucide-react-native';
import type { MainTabParamList } from './types';
import { HomeStackNavigator } from './HomeStackNavigator';
import { MemoryScreen } from '../screens/MemoryScreen';
import { ToolsScreen } from '../screens/ToolsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useTheme } from '../theme/ThemeProvider';
import { blur, spacing } from '../theme/tokens';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Never actually rendered - the "Voice" tab's tabPress is intercepted below to push the
// VoiceOverlay modal instead of navigating to a tab screen.
function VoiceTabPlaceholder() {
  return null;
}

function VoiceTabButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityState={accessibilityState} style={styles.voiceButtonWrap}>
      <LinearGradient colors={colors.acGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.voiceButton}>
        <Mic size={22} color={colors.acFg} />
      </LinearGradient>
    </Pressable>
  );
}

export function MainTabNavigator() {
  const { colors, mode } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ac,
        tabBarInactiveTintColor: colors.tx4,
        tabBarShowLabel: false,
        tabBarStyle: [styles.tabBar, { borderTopColor: colors.glassBorder }],
        tabBarBackground: () => (
          <BlurView
            intensity={blur.dock}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFillStrong }]}
          />
        ),
      }}
    >
      <Tab.Screen
        name="HomeStack"
        component={HomeStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Memory"
        component={MemoryScreen}
        options={{ tabBarIcon: ({ color, size }) => <Brain color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Voice"
        component={VoiceTabPlaceholder}
        options={{ tabBarButton: (props) => <VoiceTabButton {...props} /> }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('VoiceOverlay' as never);
          },
        })}
      />
      <Tab.Screen
        name="Tools"
        component={ToolsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    height: 78,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    elevation: 0,
  },
  voiceButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    height: 52,
    width: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#38b6ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
});
