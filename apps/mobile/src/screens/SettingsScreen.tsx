import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeMode } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { Button, GlassCard } from '../components/ui';

const NAV_ITEMS = ['Appearance', 'Account', 'Voice', 'Language', 'Memory', 'Privacy', 'Notifications', 'Security'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function ProfileHeader() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const name = user?.displayName || user?.email || 'FRIDAY User';

  return (
    <View style={styles.profileHeader}>
      <View style={[styles.profileAvatar, { borderColor: colors.acL, backgroundColor: colors.acS }]}>
        <Text style={[styles.profileAvatarText, { color: colors.ac, fontFamily: fonts.mono }]}>{initials(name)}</Text>
      </View>
      <View style={styles.profileInfo}>
        <Text style={[type.headlineMd, { color: colors.tx, fontFamily: fonts.heading }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[metaLabelStyle, styles.profileMeta, { color: colors.ac3 }]}>FRIDAY CORE · V2.4</Text>
      </View>
    </View>
  );
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
}

function AccountPanel() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<GoogleStatus>('/google/status');
        if (!cancelled) setStatus(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load Google account status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      // NOTE: same limitation as LoginScreen's Google button - the backend's OAuth
      // callback redirects to the web app's CORS origin unconditionally (apps/api
      // google-oauth.controller.ts), with no concept of a mobile deep-link target yet.
      // This opens the correct flow, but completing it end-to-end needs a backend change
      // (redirect to this app's `friday://` scheme for mobile-initiated requests).
      const redirectUrl = Linking.createURL('settings/google');
      const { url } = await authFetch<{ url: string }>('/google/authorize/connect', { method: 'POST' });
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type === 'success') {
        const res = await authFetch<GoogleStatus>('/google/status');
        setStatus(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Google sign-in.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await authFetch('/google', { method: 'DELETE' });
      setStatus({ connected: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect Google account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={[styles.panelTitle, { color: colors.tx, fontFamily: fonts.heading }]}>Account</Text>
      <Text style={[styles.panelSubtitle, { color: colors.tx3, fontFamily: fonts.body }]}>
        Connect Google to let FRIDAY see unread email, manage your calendar, and search the web.
      </Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.tx3} size="small" />
          <Text style={[styles.loadingText, { color: colors.tx3, fontFamily: fonts.body }]}>
            Checking connection…
          </Text>
        </View>
      ) : (
        <GlassCard tier={2} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: colors.tx, fontFamily: fonts.body }]}>Google</Text>
            <Text style={[styles.rowSubtitle, { color: colors.tx3, fontFamily: fonts.body }]}>
              {status?.connected ? `Connected as ${status.email}` : 'Not connected'}
            </Text>
          </View>
          {status?.connected ? (
            <Button
              label={busy ? 'Disconnecting…' : 'Disconnect'}
              variant="destructive"
              onPress={() => void disconnect()}
              disabled={busy}
              style={styles.compactButton}
            />
          ) : (
            <Button
              label={busy ? 'Redirecting…' : 'Connect'}
              onPress={() => void connect()}
              disabled={busy}
              style={styles.compactButton}
            />
          )}
        </GlassCard>
      )}

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}
    </View>
  );
}

interface Voice {
  name: string;
  description: string;
}

interface VoiceOptions {
  voices: Voice[];
  deliveryStyles: { key: string; label: string }[];
}

interface VoiceSettings {
  voiceName: string | null;
  voiceDeliveryStyle: string | null;
}

function VoicePanel() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const [options, setOptions] = useState<VoiceOptions | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>({ voiceName: null, voiceDeliveryStyle: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [opts, current] = await Promise.all([
          authFetch<VoiceOptions>('/users/voice-options'),
          authFetch<VoiceSettings>('/users/me/voice-settings'),
        ]);
        if (cancelled) return;
        setOptions(opts);
        setSettings(current);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load voice settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const update = async (patch: Partial<VoiceSettings>) => {
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await authFetch('/users/me/voice-settings', { method: 'PATCH', body: JSON.stringify(patch) });
    } catch (e) {
      setSettings(previous);
      setError(e instanceof Error ? e.message : 'Could not save that change.');
    }
  };

  return (
    <View>
      <Text style={[styles.panelTitle, { color: colors.tx, fontFamily: fonts.heading }]}>Voice</Text>
      <Text style={[styles.panelSubtitle, { color: colors.tx3, fontFamily: fonts.body }]}>
        Applies to voice mode - Gemini&rsquo;s spoken voice and how it paces and phrases what it says.
      </Text>

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

      {loading || !options ? (
        <Text style={[styles.loadingText, { color: colors.tx3, fontFamily: fonts.body }]}>Loading…</Text>
      ) : (
        <View>
          <Text style={[styles.sectionLabel, { color: colors.tx, fontFamily: fonts.body }]}>Voice</Text>
          <Text style={[styles.rowSubtitle, styles.sectionHint, { color: colors.tx3, fontFamily: fonts.body }]}>
            The prebuilt voice Gemini speaks with.
          </Text>

          <View style={[styles.optionRow, { borderColor: colors.line }]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowTitle, { color: colors.tx, fontFamily: fonts.body }]}>Default</Text>
              <Text style={[styles.rowSubtitle, { color: colors.tx4, fontFamily: fonts.body }]}>Gemini decides</Text>
            </View>
            <Pressable
              onPress={() => void update({ voiceName: null })}
              disabled={settings.voiceName === null}
              style={[
                settings.voiceName === null ? styles.buttonSelected : styles.button,
                { borderColor: colors.line2, backgroundColor: settings.voiceName === null ? colors.acS : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: settings.voiceName === null ? colors.ac : colors.tx, fontFamily: fonts.body },
                ]}
              >
                {settings.voiceName === null ? 'Selected' : 'Select'}
              </Text>
            </Pressable>
          </View>

          {options.voices.map(({ name, description }) => {
            const isSelected = settings.voiceName === name;
            return (
              <View key={name} style={[styles.optionRow, { borderColor: colors.line }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: colors.tx, fontFamily: fonts.body }]}>{name}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.tx4, fontFamily: fonts.body }]}>{description}</Text>
                </View>
                <Pressable
                  onPress={() => void update({ voiceName: name })}
                  disabled={isSelected}
                  style={[
                    isSelected ? styles.buttonSelected : styles.button,
                    { borderColor: colors.line2, backgroundColor: isSelected ? colors.acS : 'transparent' },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: isSelected ? colors.ac : colors.tx, fontFamily: fonts.body }]}>
                    {isSelected ? 'Selected' : 'Select'}
                  </Text>
                </Pressable>
              </View>
            );
          })}

          <Text style={[styles.sectionLabel, styles.deliveryLabel, { color: colors.tx, fontFamily: fonts.body }]}>
            Delivery style
          </Text>
          <Text style={[styles.rowSubtitle, styles.sectionHint, { color: colors.tx3, fontFamily: fonts.body }]}>
            How FRIDAY paces and phrases what it says out loud.
          </Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => void update({ voiceDeliveryStyle: null })}
              style={[
                styles.chip,
                {
                  borderColor: settings.voiceDeliveryStyle === null ? colors.ac : colors.line2,
                  backgroundColor: settings.voiceDeliveryStyle === null ? colors.acS : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: settings.voiceDeliveryStyle === null ? colors.ac : colors.tx2, fontFamily: fonts.body },
                ]}
              >
                Default
              </Text>
            </Pressable>
            {options.deliveryStyles.map((style) => {
              const isSelected = settings.voiceDeliveryStyle === style.key;
              return (
                <Pressable
                  key={style.key}
                  onPress={() => void update({ voiceDeliveryStyle: style.key })}
                  style={[
                    styles.chip,
                    { borderColor: isSelected ? colors.ac : colors.line2, backgroundColor: isSelected ? colors.acS : 'transparent' },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? colors.ac : colors.tx2, fontFamily: fonts.body }]}>
                    {style.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

function AppearancePanel() {
  const { colors, mode, setMode } = useTheme();

  const ThemeCard = ({ target, label }: { target: ThemeMode; label: string }) => {
    const active = mode === target;
    return (
      <Pressable
        onPress={() => setMode(target)}
        style={[
          styles.themeCard,
          { borderColor: active ? colors.ac : colors.line, backgroundColor: colors.panel2 },
        ]}
      >
        <View style={[styles.themePreview, target === 'dark' ? styles.themePreviewDark : styles.themePreviewLight]} />
        <View style={styles.themeCardFooter}>
          <Text style={[styles.rowTitle, { color: colors.tx, fontFamily: fonts.body }]}>{label}</Text>
          {active ? <Text style={{ color: colors.ac, fontSize: 13 }}>✓</Text> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View>
      <Text style={[styles.panelTitle, { color: colors.tx, fontFamily: fonts.heading }]}>Appearance</Text>
      <Text style={[styles.panelSubtitle, { color: colors.tx3, fontFamily: fonts.body }]}>
        Dark is the default FRIDAY experience. Light mode keeps the same structure and accent.
      </Text>
      <View style={styles.themeRow}>
        <ThemeCard target="dark" label="Dark" />
        <ThemeCard target="light" label="Light" />
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const { colors } = useTheme();
  const [active, setActive] = useState('Appearance');

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ProfileHeader />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.line }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = active === item;
          return (
            <Pressable
              key={item}
              onPress={() => setActive(item)}
              style={[
                styles.tab,
                {
                  borderColor: isActive ? colors.acM : colors.line2,
                  backgroundColor: isActive ? colors.acS : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.ac : colors.tx3, fontFamily: isActive ? fonts.bodyMedium : fonts.body },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {active === 'Appearance' && <AppearancePanel />}
        {active === 'Account' && <AccountPanel />}
        {active === 'Voice' && <VoicePanel />}
        {active !== 'Appearance' && active !== 'Account' && active !== 'Voice' && (
          <View>
            <Text style={[type.headlineMd, { color: colors.tx, fontFamily: fonts.heading }]}>{active}</Text>
            <Text style={[styles.panelSubtitle, { color: colors.tx3, fontFamily: fonts.body }]}>Coming soon.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  tabBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13.5,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.islandBottomOffset + spacing.xl,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  profileAvatar: {
    height: 52,
    width: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: 16,
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  profileMeta: {
    letterSpacing: 1.2,
  },
  compactButton: {
    height: 38,
    paddingHorizontal: spacing.md,
  },
  panelTitle: {
    fontSize: 20,
  },
  panelSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    maxWidth: 480,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 13.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
  },
  rowSubtitle: {
    fontSize: 12.5,
    marginTop: spacing.xs,
  },
  button: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonSelected: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    fontSize: 13,
  },
  buttonFilled: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonFilledText: {
    fontSize: 13,
  },
  error: {
    fontSize: 13,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontSize: 13.5,
  },
  sectionHint: {
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
  },
  deliveryLabel: {
    marginTop: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontSize: 12.5,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  themePreview: {
    height: 90,
  },
  themePreviewDark: {
    backgroundColor: '#0a0e12',
  },
  themePreviewLight: {
    backgroundColor: '#eef1f5',
  },
  themeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
});
