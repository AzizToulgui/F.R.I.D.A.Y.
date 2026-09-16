import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Calendar, Clock, Cloud, FileText, Mail, Mic, Search } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { GlassCard } from '../components/ui';

interface ToolInfo {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  enabled: boolean;
}

interface GroupMember {
  name: string;
  action: string;
}

interface ToolGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Root-stack route to open for a fuller management screen, if one exists. */
  route?: 'Reminders' | 'Notes';
  members: GroupMember[];
}

// Ported from apps/web/src/views/ToolsView.tsx's TOOL_GROUPS - every registered tool must
// appear in exactly one group's `members`. Icons replace the old letter-badge placeholders.
const TOOL_GROUPS: ToolGroup[] = [
  {
    key: 'reminders',
    label: 'Reminders',
    icon: Bell,
    route: 'Reminders',
    members: [
      { name: 'create_reminder', action: 'Create' },
      { name: 'list_reminders', action: 'List' },
      { name: 'update_reminder', action: 'Update' },
      { name: 'delete_reminder', action: 'Delete' },
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    icon: FileText,
    route: 'Notes',
    members: [
      { name: 'create_note', action: 'Create' },
      { name: 'list_notes', action: 'List' },
      { name: 'update_note', action: 'Update' },
      { name: 'delete_note', action: 'Delete' },
    ],
  },
  {
    key: 'calendar',
    label: 'Google Calendar',
    icon: Calendar,
    members: [
      { name: 'list_calendar_events', action: 'List' },
      { name: 'create_calendar_event', action: 'Create' },
      { name: 'update_calendar_event', action: 'Update' },
    ],
  },
  {
    key: 'gmail',
    label: 'Gmail',
    icon: Mail,
    members: [{ name: 'list_unread_emails', action: 'Read unread email' }],
  },
  {
    key: 'voice_memos',
    label: 'Voice Memos',
    icon: Mic,
    members: [
      { name: 'record_voice_memo', action: 'Record' },
      { name: 'stop_recording_voice_memo', action: 'Stop recording' },
      { name: 'play_voice_memo', action: 'Play' },
      { name: 'list_voice_memos', action: 'List' },
    ],
  },
  {
    key: 'current_time',
    label: 'Current Time',
    icon: Clock,
    members: [{ name: 'get_current_time', action: 'Check the time' }],
  },
  {
    key: 'search_application_data',
    label: 'Search Your Data',
    icon: Search,
    members: [{ name: 'search_application_data', action: 'Search your data' }],
  },
  {
    key: 'weather',
    label: 'Weather',
    icon: Cloud,
    members: [{ name: 'get_weather', action: 'Check the weather' }],
  },
];

interface AssembledGroup {
  group: ToolGroup;
  tools: ToolInfo[];
  allEnabled: boolean;
}

export function ToolsScreen() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const navigation = useNavigation<any>();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingGroups, setPendingGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const toolList = await authFetch<ToolInfo[]>('/tools');
        if (!cancelled) setTools(toolList);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load tools.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const byName = useMemo(() => new Map(tools.map((t) => [t.name, t])), [tools]);

  const assembled: AssembledGroup[] = useMemo(
    () =>
      TOOL_GROUPS.map((group) => ({
        group,
        tools: group.members.map((m) => byName.get(m.name)).filter((t): t is ToolInfo => Boolean(t)),
        allEnabled: group.members.every((m) => byName.get(m.name)?.enabled ?? true),
      })).filter((g) => g.tools.length > 0),
    [byName],
  );

  const toggleGroup = async (group: ToolGroup, nextEnabled: boolean) => {
    const previous = tools;
    const names = new Set(group.members.map((m) => m.name));
    setTools((prev) => prev.map((t) => (names.has(t.name) ? { ...t, enabled: nextEnabled } : t)));
    setPendingGroups((prev) => new Set(prev).add(group.key));
    try {
      await Promise.all(
        group.members.map((m) =>
          authFetch(`/tools/${encodeURIComponent(m.name)}/enabled`, {
            method: 'PATCH',
            body: JSON.stringify({ enabled: nextEnabled }),
          }),
        ),
      );
    } catch (e) {
      setTools(previous);
      setError(e instanceof Error ? e.message : `Could not update "${group.label}".`);
    } finally {
      setPendingGroups((prev) => {
        const next = new Set(prev);
        next.delete(group.key);
        return next;
      });
    }
  };

  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.bg }]} contentContainerStyle={styles.container}>
      <Text style={[type.headlineLg, { color: colors.tx, fontFamily: fonts.heading }]}>Connected Tools</Text>
      <Text style={[type.bodySm, styles.subtitle, { color: colors.tx3 }]}>
        Capabilities FRIDAY can use on your behalf, in both voice and text. Switch a whole capability off to stop
        FRIDAY from using any part of it.
      </Text>

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

      {loading ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>Loading tools…</Text>
      ) : (
        <View style={styles.list}>
          {assembled.map(({ group, tools: groupTools, allEnabled }) => {
            const Icon = group.icon;
            const CardInner = (
              <>
                <View style={styles.cardRow}>
                  <View style={[styles.badge, { backgroundColor: colors.acS, borderColor: colors.acM }]}>
                    <Icon size={16} color={colors.ac} />
                  </View>
                  <Text style={[styles.label, { color: colors.tx, fontFamily: fonts.bodyMedium }]}>{group.label}</Text>
                  <Switch
                    value={allEnabled}
                    disabled={pendingGroups.has(group.key)}
                    onValueChange={(checked) => void toggleGroup(group, checked)}
                    trackColor={{ false: colors.line2, true: colors.acM }}
                    thumbColor={allEnabled ? colors.ac : colors.tx4}
                  />
                </View>
                {group.members.length > 1 ? (
                  <View style={styles.membersList}>
                    {group.members.map((m) => (
                      <Text key={m.name} style={[styles.memberText, { color: colors.tx3, fontFamily: fonts.body }]}>
                        · {m.action}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.descriptionText, { color: colors.tx3, fontFamily: fonts.body }]}>
                    {groupTools[0]?.description}
                  </Text>
                )}
              </>
            );

            return group.route ? (
              <Pressable key={group.key} onPress={() => navigation.getParent()?.navigate(group.route)}>
                <GlassCard tier={2} style={[styles.card, !allEnabled && styles.disabled]}>
                  {CardInner}
                </GlassCard>
              </Pressable>
            ) : (
              <GlassCard key={group.key} tier={2} style={[styles.card, !allEnabled && styles.disabled]}>
                {CardInner}
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
    padding: spacing.md,
  },
  disabled: {
    opacity: 0.6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    height: 36,
    width: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 14.5,
  },
  membersList: {
    marginTop: spacing.sm,
    gap: 3,
  },
  memberText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  descriptionText: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
