import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { GlassCard } from '../components/ui';

interface Note {
  id: string;
  title: string | null;
  content: string;
}

// Read-only by design (Section 8) - notes are managed exclusively by FRIDAY via its tools
// (voice or chat), not by UI here. Do not add create/edit/delete controls.
export function NotesScreen() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await authFetch<Note[]>('/notes');
      setNotes(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notes.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.bg }]} contentContainerStyle={styles.container}>
      <Text style={[type.headlineLg, { color: colors.tx, fontFamily: fonts.heading }]}>Notes</Text>
      <Text style={[type.bodySm, styles.subtitle, { color: colors.tx3 }]}>
        Ask FRIDAY, in chat or voice, to save a note and it&rsquo;ll show up here.
      </Text>

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

      {loading ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>Loading notes…</Text>
      ) : notes.length === 0 ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>
          Nothing yet - ask FRIDAY to save a note and it&rsquo;ll show up here.
        </Text>
      ) : (
        <View style={styles.list}>
          {notes.map((note) => (
            <GlassCard key={note.id} tier={2} style={styles.card}>
              {note.title ? (
                <Text style={[styles.title, { color: colors.tx, fontFamily: fonts.body }]}>{note.title}</Text>
              ) : null}
              <Text
                style={[
                  styles.content,
                  { color: colors.tx3, fontFamily: fonts.body, marginTop: note.title ? spacing.xs : 0 },
                ]}
              >
                {note.content}
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
  title: {
    fontSize: 14,
  },
  content: {
    fontSize: 13,
    lineHeight: 19,
  },
});
