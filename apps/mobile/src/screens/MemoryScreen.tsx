import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pencil, Search, Trash } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { Button, GlassCard, StatusChip } from '../components/ui';

interface Memory {
  id: string;
  content: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const RECENT_MS = 10 * 60 * 1000;

function formatMeta(memory: Memory): string {
  const created = new Date(memory.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  if (!memory.lastUsedAt) return `ADDED ${created.toUpperCase()}`;
  const used = new Date(memory.lastUsedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return `ADDED ${created.toUpperCase()} · LAST USED ${used.toUpperCase()}`;
}

export function MemoryScreen() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<Memory[]>('/memories');
      setMemories(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load memories.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter((m) => m.content.toLowerCase().includes(q));
  }, [memories, query]);

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setDraft(memory.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const saveEdit = async (id: string) => {
    const content = draft.trim();
    if (!content) return;
    try {
      const updated = await authFetch<Memory>(`/memories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that edit.');
    }
  };

  const remove = async (id: string) => {
    const previous = memories;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await authFetch(`/memories/${id}`, { method: 'DELETE' });
    } catch (e) {
      setMemories(previous);
      setError(e instanceof Error ? e.message : 'Could not delete that memory.');
    }
  };

  const clearAll = () => {
    Alert.alert('Clear all memories?', 'Everything FRIDAY remembers about you will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          const previous = memories;
          setMemories([]);
          try {
            await authFetch('/memories', { method: 'DELETE' });
          } catch (e) {
            setMemories(previous);
            setError(e instanceof Error ? e.message : 'Could not clear memories.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[type.headlineLg, { color: colors.tx, fontFamily: fonts.heading }]}>Memory</Text>
          <Text style={[type.bodySm, styles.subtitle, { color: colors.tx3 }]}>
            FRIDAY keeps a small set of facts so future conversations start informed. Everything here is editable,
            and nothing is stored without appearing on this page.
          </Text>
        </View>
        <StatusChip label={`${memories.length} indexed`} tone={memories.length > 0 ? 'ok' : 'neutral'} />
      </View>

      <View style={styles.toolbar}>
        <GlassCard tier={2} style={styles.searchCard}>
          <Search size={15} color={colors.tx4} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search memories…"
            placeholderTextColor={colors.tx5}
            style={[styles.searchInput, { color: colors.tx, fontFamily: fonts.body }]}
          />
        </GlassCard>
        <Button
          label="Clear all"
          variant="destructive"
          onPress={clearAll}
          disabled={memories.length === 0}
          style={styles.clearButton}
        />
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

      {loading ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>Loading memories…</Text>
      ) : filtered.length === 0 ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>
          {memories.length === 0
            ? "Nothing remembered yet - it fills in as you talk to FRIDAY."
            : 'No memories match your search.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {filtered.map((m) => {
            const fresh = Date.now() - new Date(m.createdAt).getTime() < RECENT_MS;
            const isEditing = editingId === m.id;
            return (
              <GlassCard
                key={m.id}
                tier={2}
                style={[styles.card, fresh && { backgroundColor: colors.acS, borderColor: colors.acM }]}
              >
                {isEditing ? (
                  <TextInput
                    autoFocus
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    style={[styles.editInput, { color: colors.tx, borderColor: colors.line2, fontFamily: fonts.body }]}
                  />
                ) : (
                  <Text style={[styles.content, { color: colors.tx, fontFamily: fonts.body }]}>{m.content}</Text>
                )}
                <Text style={[metaLabelStyle, styles.meta, { color: fresh ? colors.ac : colors.tx4 }]}>
                  {fresh ? 'JUST REMEMBERED' : formatMeta(m)}
                </Text>

                <View style={styles.actions}>
                  {isEditing ? (
                    <>
                      <Pressable onPress={() => void saveEdit(m.id)} style={styles.actionButton}>
                        <Text style={[styles.actionText, { color: colors.ac, fontFamily: fonts.body }]}>Save</Text>
                      </Pressable>
                      <Pressable onPress={cancelEdit} style={styles.actionButton}>
                        <Text style={[styles.actionText, { color: colors.tx3, fontFamily: fonts.body }]}>Cancel</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable onPress={() => startEdit(m)} style={styles.actionButton}>
                        <Pencil size={13} color={colors.tx3} />
                        <Text style={[styles.actionText, { color: colors.tx3, fontFamily: fonts.body }]}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => void remove(m.id)} style={styles.actionButton}>
                        <Trash size={13} color={colors.danger} />
                        <Text style={[styles.actionText, { color: colors.danger, fontFamily: fonts.body }]}>Delete</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </GlassCard>
            );
          })}
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
    paddingBottom: spacing.islandBottomOffset + spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    maxWidth: 480,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearButton: {
    height: 44,
    paddingHorizontal: spacing.md,
  },
  disabled: {
    opacity: 0.4,
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
  content: {
    fontSize: 14,
    lineHeight: 20,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 60,
  },
  meta: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
  },
  actionText: {
    fontSize: 13,
  },
});
