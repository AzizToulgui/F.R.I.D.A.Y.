import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  Home: undefined;
  Chat: { conversationId?: string } | undefined;
};

// The center tab is a non-navigating placeholder route - its tabPress is intercepted to open
// the VoiceOverlay modal instead (see MainTabNavigator.tsx) - it needs a key here purely for
// route registration/typing.
export type MainTabParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList> | undefined;
  Memory: undefined;
  Voice: undefined;
  Tools: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Search: undefined;
  VoiceOverlay: undefined;
  IntelligenceDrawer: undefined;
  Knowledge: undefined;
  Reminders: undefined;
  Notes: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};
