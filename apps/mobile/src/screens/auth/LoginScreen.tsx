import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { useAuth } from '../../lib/auth/AuthProvider';
import { API_BASE_URL } from '../../lib/api';

type Mode = 'login' | 'register';

export function LoginScreen() {
  const { colors } = useTheme();
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, displayName);
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setGoogleError(false);
    try {
      // NOTE: the backend's /google/authorize/login callback currently redirects to the
      // web app's CORS origin unconditionally (apps/api google-oauth.controller.ts) - it
      // has no concept of a mobile deep-link target yet. This opens the correct flow per
      // Section 3, but completing it end-to-end needs a small backend change (redirect to
      // this app's `friday://` scheme for mobile-initiated authorize requests) that is out
      // of scope here per Section 11. Flagging rather than silently no-op'ing.
      const redirectUrl = Linking.createURL('auth/google');
      const result = await WebBrowser.openAuthSessionAsync(`${API_BASE_URL}/google/authorize/login`, redirectUrl);
      if (result.type !== 'success') setGoogleError(true);
    } catch {
      setGoogleError(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.brandRow}>
        <View style={[styles.brandDot, { borderColor: colors.acL }]}>
          <View style={[styles.brandInnerRing, { borderColor: colors.acM }]} />
          <View style={[styles.brandGlow, { backgroundColor: colors.acTx }]} />
        </View>
        <Text style={[styles.brandText, { color: colors.tx3, fontFamily: fonts.mono }]}>FRIDAY</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }]}>
        <Text style={[styles.title, { color: colors.tx, fontFamily: fonts.heading }]}>
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </Text>

        {googleError ? (
          <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>
            Could not sign in with Google. Please try again.
          </Text>
        ) : null}

        <Pressable
          onPress={onGoogle}
          style={[styles.googleButton, { borderColor: colors.line2 }]}
        >
          <Text style={[styles.googleButtonText, { color: colors.tx, fontFamily: fonts.body }]}>
            Continue with Google
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.line }]} />
          <Text style={[styles.dividerText, { color: colors.tx4, fontFamily: fonts.body }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.line }]} />
        </View>

        {mode === 'register' ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.tx3, fontFamily: fonts.body }]}>Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Aditya Kapoor"
              placeholderTextColor={colors.tx5}
              style={[styles.input, { color: colors.tx, borderColor: colors.line2, backgroundColor: colors.bg2 }]}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.tx3, fontFamily: fonts.body }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.tx5}
            style={[styles.input, { color: colors.tx, borderColor: colors.line2, backgroundColor: colors.bg2 }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.tx3, fontFamily: fonts.body }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            placeholderTextColor={colors.tx5}
            style={[styles.input, { color: colors.tx, borderColor: colors.line2, backgroundColor: colors.bg2 }]}
          />
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !email || password.length < 8}
          style={[styles.submitButton, { backgroundColor: colors.ac, opacity: submitting ? 0.7 : 1 }]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.acFg} />
          ) : (
            <Text style={[styles.submitText, { color: colors.acFg, fontFamily: fonts.bodyMedium }]}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={[styles.toggleText, { color: colors.tx3, fontFamily: fonts.body }]}>
            {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  brandDot: {
    height: 28,
    width: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInnerRing: {
    height: 16,
    width: 16,
    borderRadius: 8,
    borderWidth: 1,
    position: 'absolute',
  },
  brandGlow: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  brandText: {
    fontSize: 13,
    letterSpacing: 3,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  googleButton: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  error: {
    fontSize: 12.5,
  },
  submitButton: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  submitText: {
    fontSize: 15,
  },
  toggleText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
