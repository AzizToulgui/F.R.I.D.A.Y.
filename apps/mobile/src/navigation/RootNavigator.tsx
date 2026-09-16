import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useAuth } from '../lib/auth/AuthProvider';
import { useTheme } from '../theme/ThemeProvider';
import { LoadingScreen } from '../components/LoadingScreen';
import { AuthStackNavigator } from './AuthStackNavigator';
import { MainStackNavigator } from './MainStackNavigator';

// Mirrors AuthGate on web: silently attempt a refresh on launch (AuthProvider's mount
// effect), show a loading state while that's pending, then mount either the Auth Stack or
// the Main navigator - never both, and never a bare unauthenticated screen underneath.
export function RootNavigator() {
  const { status } = useAuth();
  const { mode, colors } = useTheme();

  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.panel,
      text: colors.tx,
      border: colors.line,
      primary: colors.ac,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {status === 'loading' ? (
        <LoadingScreen />
      ) : status === 'authenticated' ? (
        <MainStackNavigator />
      ) : (
        <AuthStackNavigator />
      )}
    </NavigationContainer>
  );
}
