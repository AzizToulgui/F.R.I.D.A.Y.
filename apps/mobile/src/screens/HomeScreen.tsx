import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BrainCircuit, ChevronRight, Globe, Mic } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, spacing, type } from '../theme/tokens';
import { MessageComposer } from '../components/chat/MessageComposer';
import { GlassCard } from '../components/ui';
import { Orb } from '../components/orb/Orb';
import { useChatContext } from '../lib/chat/ChatProvider';
import { useAuth } from '../lib/auth/AuthProvider';
import type { HomeStackParamList } from '../navigation/types';

const QUICK_ACTIONS = [
  { key: 'deepThink', label: 'Deep Think', icon: BrainCircuit, seed: 'Think deeply about…' },
  { key: 'webSearch', label: 'Web Search', icon: Globe, seed: 'Search the web for…' },
];

// "Synthesized Focus" feed from the Stitch mock, backed by the same real prompt-starters the
// old suggestion grid used (no live agent/activity feed exists yet - dressing up fabricated
// "PR reviewed" style cards would misrepresent what the app actually does).
const FOCUS_ITEMS = [
  { title: 'Plan my day', sub: 'Ask about your priorities', text: 'Help me plan my day.' },
  { title: 'Search my knowledge', sub: 'Look across uploaded documents', text: 'Search my knowledge for…' },
  { title: 'Help me write', sub: 'Draft something from scratch', text: 'Help me write a draft of…' },
  { title: 'Analyze a document', sub: 'Drop a file to begin', text: 'Summarize the document I just uploaded.' },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { send, streaming, reset } = useChatContext();
  const [draft, setDraft] = useState('');

  const firstName = (user?.displayName || user?.email || '').split(/[\s@]/)[0];

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    reset();
    setDraft('');
    navigation.navigate('Chat');
    void send(trimmed);
  };

  const openVoice = () => navigation.getParent()?.getParent()?.navigate('VoiceOverlay' as never);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Orb state="idle" size="lg" />
        <Text style={[metaLabelStyle, styles.coreLabel, { color: colors.tx4 }]}>FRIDAY CORE</Text>
        <Text style={[styles.heading, { color: colors.tx, fontFamily: fonts.heading }]}>
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </Text>
        <Text style={[type.bodyMd, styles.subheading, { color: colors.tx3 }]}>Where should we focus tonight?</Text>
      </View>

      <View style={styles.composerWrap}>
        <MessageComposer draft={draft} onDraftChange={setDraft} onSend={() => submit(draft)} streaming={streaming} />

        <View style={styles.actionRow}>
          <Pressable onPress={openVoice} style={[styles.actionChip, { borderColor: colors.acL, backgroundColor: colors.acS }]}>
            <Mic size={14} color={colors.ac} />
            <Text style={[styles.actionText, { color: colors.ac, fontFamily: fonts.bodyMedium }]}>Voice Mode</Text>
          </Pressable>
          {QUICK_ACTIONS.map(({ key, label, icon: Icon, seed }) => (
            <Pressable
              key={key}
              onPress={() => setDraft(seed)}
              style={[styles.actionChip, { borderColor: colors.line2 }]}
            >
              <Icon size={14} color={colors.tx2} />
              <Text style={[styles.actionText, { color: colors.tx2, fontFamily: fonts.bodyMedium }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[metaLabelStyle, styles.sectionLabel, { color: colors.tx4 }]}>Synthesized Focus</Text>
        <View style={styles.feed}>
          {FOCUS_ITEMS.map((item) => (
            <Pressable key={item.title} onPress={() => setDraft(item.text)}>
              <GlassCard tier={2} style={styles.feedCard}>
                <View style={styles.feedCardText}>
                  <Text style={[styles.feedTitle, { color: colors.tx, fontFamily: fonts.bodyMedium }]}>{item.title}</Text>
                  <Text style={[styles.feedSub, { color: colors.tx3, fontFamily: fonts.body }]}>{item.sub}</Text>
                </View>
                <ChevronRight size={16} color={colors.tx4} />
              </GlassCard>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.islandBottomOffset + spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  coreLabel: {
    marginTop: spacing.md,
    letterSpacing: 3,
  },
  heading: {
    marginTop: spacing.sm,
    fontSize: 26,
  },
  subheading: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  composerWrap: {
    width: '100%',
    maxWidth: 640,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: 9999,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12.5,
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  feed: {
    gap: spacing.sm,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  feedCardText: {
    flex: 1,
    gap: 2,
  },
  feedTitle: {
    fontSize: 14,
  },
  feedSub: {
    fontSize: 12,
  },
});
