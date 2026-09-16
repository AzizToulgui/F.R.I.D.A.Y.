import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Search as SearchIcon, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, radius, spacing } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { useChatContext } from '../lib/chat/ChatProvider';
import type { ConversationSummary } from '../lib/chat/useChat';
import { Button, GlassCard, StatusChip } from '../components/ui';
import { Orb } from '../components/orb/Orb';
import type { RootStackParamList } from '../navigation/types';

// Absorbs the logic that used to live in the left-drawer's DrawerContent.tsx (conversation
// history grouping/rename/delete, new-conversation action) now that navigation is bottom
// tabs - this is a normal pushed screen (the Stitch "Intelligence Drawer & Tool Hub" mock)
// reached via a header icon, not a slide-out drawer.

interface ToolInfo {
  name: string;
  enabled: boolean;
}

type DateGroup = 'Today' | 'Yesterday' | 'Earlier';
const DATE_GROUPS: DateGroup[] = ['Today', 'Yesterday', 'Earlier'];

function dateGroup(iso: string): DateGroup {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function IntelligenceDrawerScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout, authFetch } = useAuth();
  const { conversations, activeConversationId, switchTo, removeConversation, renameConversation, reset } =
    useChatContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [engineCount, setEngineCount] = useState<{ enabled: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tools = await authFetch<ToolInfo[]>('/tools');
        if (!cancelled) setEngineCount({ enabled: tools.filter((t) => t.enabled).length, total: tools.length });
      } catch {
        // Connected-engines strip is a glance summary, not critical - fail silently.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const goToHome = () => navigation.navigate('Main', { screen: 'HomeStack', params: { screen: 'Home' } });
  const goToChat = (conversationId?: string) =>
    navigation.navigate('Main', { screen: 'HomeStack', params: { screen: 'Chat', params: { conversationId } } });

  const newConversation = () => {
    reset();
    goToHome();
  };

  const selectConversation = (id: string) => {
    void switchTo(id);
    goToChat(id);
  };

  const startEditing = (c: ConversationSummary) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const commitEdit = () => {
    if (editingId) void renameConversation(editingId, editingTitle);
    setEditingId(null);
  };

  const confirmDelete = (c: ConversationSummary) => {
    Alert.alert('Delete conversation?', `"${c.title}" will be permanently deleted. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeConversation(c.id) },
    ]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Orb state="idle" size="sm" />
          <View>
            <Text style={[styles.brandTitle, { color: colors.tx, fontFamily: fonts.heading }]}>FRIDAY</Text>
            <Text style={[styles.brandSubtitle, { color: colors.tx4, fontFamily: fonts.body }]}>
              {user?.displayName || user?.email}
            </Text>
          </View>
        </View>
        <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={styles.closeButton}>
          <X color={colors.tx3} size={20} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Button label="New Dialogue Session" onPress={newConversation} icon={<Plus size={16} color={colors.acFg} />} />

        <Pressable onPress={() => navigation.navigate('Search')}>
          <GlassCard tier={2} style={styles.searchCard}>
            <SearchIcon size={16} color={colors.tx4} />
            <Text style={[styles.searchPlaceholder, { color: colors.tx4, fontFamily: fonts.body }]}>
              Search dialogues, memories, tools…
            </Text>
          </GlassCard>
        </Pressable>

        {engineCount ? (
          <View style={styles.enginesRow}>
            <Text style={[metaLabelStyle, { color: colors.tx4 }]}>Connected Engines & Hubs</Text>
            <StatusChip
              label={`${engineCount.enabled} / ${engineCount.total} active`}
              tone={engineCount.enabled > 0 ? 'ok' : 'neutral'}
            />
          </View>
        ) : null}

        <View style={styles.history}>
          {conversations.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.tx4, fontFamily: fonts.body }]}>No conversations yet</Text>
          ) : (
            DATE_GROUPS.map((group) => {
              const items = conversations.filter((c) => dateGroup(c.updatedAt) === group);
              if (items.length === 0) return null;
              return (
                <View key={group}>
                  <Text style={[metaLabelStyle, styles.groupLabel, { color: colors.tx4 }]}>{group.toUpperCase()}</Text>
                  {items.map((c) =>
                    editingId === c.id ? (
                      <TextInput
                        key={c.id}
                        autoFocus
                        value={editingTitle}
                        onChangeText={setEditingTitle}
                        onSubmitEditing={commitEdit}
                        onBlur={commitEdit}
                        style={[
                          styles.editInput,
                          { color: colors.tx, borderColor: colors.line2, fontFamily: fonts.body },
                        ]}
                      />
                    ) : (
                      <Pressable
                        key={c.id}
                        onPress={() => selectConversation(c.id)}
                        onLongPress={() => startEditing(c)}
                        style={[styles.historyItem, activeConversationId === c.id && { backgroundColor: colors.acS }]}
                      >
                        <Text
                          style={[styles.historyTitle, { color: colors.tx2, fontFamily: fonts.body }]}
                          numberOfLines={1}
                        >
                          {c.title}
                        </Text>
                        <Pressable hitSlop={8} onPress={() => confirmDelete(c)}>
                          <X color={colors.tx4} size={14} />
                        </Pressable>
                      </Pressable>
                    ),
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        <View style={[styles.avatar, { borderColor: colors.line2 }]}>
          <Text style={[styles.avatarText, { color: colors.tx2, fontFamily: fonts.mono }]}>
            {initials(user?.displayName || user?.email || '?')}
          </Text>
        </View>
        <View style={styles.footerInfo}>
          <Text style={[styles.userText, { color: colors.tx, fontFamily: fonts.body }]} numberOfLines={1}>
            {user?.displayName || user?.email}
          </Text>
          <Text style={[metaLabelStyle, { color: colors.tx4 }]}>GEMINI 2.5</Text>
        </View>
        <Pressable onPress={() => void logout()} hitSlop={8}>
          <Text style={[styles.signOut, { color: colors.danger, fontFamily: fonts.bodyMedium }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandTitle: {
    fontSize: 16,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchPlaceholder: {
    fontSize: 13.5,
  },
  enginesRow: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  history: {
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: 12,
    paddingVertical: spacing.sm,
  },
  groupLabel: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
  },
  historyTitle: {
    flex: 1,
    fontSize: 13.5,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: spacing.sm,
    fontSize: 13.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    padding: spacing.md,
  },
  avatar: {
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
  },
  footerInfo: {
    flex: 1,
    minWidth: 0,
  },
  userText: {
    fontSize: 12.5,
  },
  signOut: {
    fontSize: 12.5,
  },
});
