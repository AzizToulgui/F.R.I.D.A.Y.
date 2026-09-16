import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { GlassCard } from '../components/ui';

interface Reminder {
  id: string;
  text: string;
  dueAt: string | null;
  completedAt: string | null;
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return new Date(dueAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Read-only by design (Section 8) - reminders are managed exclusively by FRIDAY via its
// tools (voice or chat), not by UI here. Do not add create/edit/delete controls.
export function RemindersScreen() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch<Reminder[]>('/reminders');
      setReminders(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reminders.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.bg }]} contentContainerStyle={styles.container}>
      <Text style={[type.headlineLg, { color: colors.tx, fontFamily: fonts.heading }]}>Reminders</Text>
      <Text style={[type.bodySm, styles.subtitle, { color: colors.tx3 }]}>
        Ask FRIDAY, in chat or voice, to remind you of something and it&rsquo;ll show up here.
      </Text>

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

      {loading ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>Loading reminders…</Text>
      ) : reminders.length === 0 ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>
          Nothing yet - ask FRIDAY to remind you of something and it&rsquo;ll show up here.
        </Text>
      ) : (
        <View style={styles.list}>
          {reminders.map((reminder) => (
            <GlassCard key={reminder.id} tier={2} style={[styles.card, reminder.completedAt && styles.cardDone]}>
              <Text style={[styles.text, { color: colors.tx, fontFamily: fonts.body }]}>{reminder.text}</Text>
              <Text style={[metaLabelStyle, styles.meta, { color: colors.tx4 }]}>
                {reminder.completedAt ? 'DONE · ' : ''}
                {formatDue(reminder.dueAt).toUpperCase()}
              </Text>
            </GlassCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    maxWidth: 480,
  },
  error: {
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: 13.5,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardDone: {
    opacity: 0.6,
  },
  text: {
    fontSize: 14,
  },
  meta: {
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
});
