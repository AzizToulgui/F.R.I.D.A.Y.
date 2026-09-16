import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { Menu } from 'lucide-react-native';
import type { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { useTheme } from '../theme/ThemeProvider';

const Stack = createNativeStackNavigator<HomeStackParamList>();

function MenuIcon() {
  const { colors } = useTheme();
  return <Menu color={colors.tx2} size={20} />;
}

// Opens the Intelligence Drawer screen (root-level modal, replaces the old slide-out
// left-drawer). Two levels of getParent(): HomeStack -> MainTabNavigator -> root
// MainStackNavigator, where IntelligenceDrawer is registered - same `as never` escape hatch
// the old DrawerContent.tsx used for its cross-navigator `navigate('Search')` call.
function HeaderMenuButton({ navigation }: { navigation: NavigationProp<ParamListBase> }) {
  return (
    <Pressable
      hitSlop={8}
      onPress={() => navigation.getParent()?.getParent()?.navigate('IntelligenceDrawer' as never)}
    >
      <MenuIcon />
    </Pressable>
  );
}

export function HomeStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'FRIDAY',
          headerRight: () => <HeaderMenuButton navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ navigation }) => ({
          title: 'Chat',
          headerRight: () => <HeaderMenuButton navigation={navigation} />,
        })}
      />
    </Stack.Navigator>
  );
}
