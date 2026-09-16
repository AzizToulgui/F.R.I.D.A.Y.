import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { SearchModal } from '../screens/SearchModal';
import { VoiceOverlayModal } from '../screens/VoiceOverlayModal';
import { IntelligenceDrawerScreen } from '../screens/IntelligenceDrawerScreen';
import { KnowledgeScreen } from '../screens/KnowledgeScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { ChatProvider } from '../lib/chat/ChatProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Search/VoiceOverlay/IntelligenceDrawer/Knowledge/Reminders/Notes are modal or push screens
// over the bottom-tab shell, mirroring AppShell's boolean overlay flags on web. Settings now
// lives inside MainTabNavigator as a real tab, not a modal here. ChatProvider wraps everything
// so Home, Chat, and the Intelligence Drawer's history list share one useChat().
export function MainStackNavigator() {
  return (
    <ChatProvider>
      <Stack.Navigator>
        <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Search" component={SearchModal} options={{ presentation: 'modal', title: 'Search' }} />
        <Stack.Screen
          name="VoiceOverlay"
          component={VoiceOverlayModal}
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="IntelligenceDrawer"
          component={IntelligenceDrawerScreen}
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen name="Knowledge" component={KnowledgeScreen} options={{ title: 'Knowledge' }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: 'Reminders' }} />
        <Stack.Screen name="Notes" component={NotesScreen} options={{ title: 'Notes' }} />
      </Stack.Navigator>
    </ChatProvider>
  );
}
