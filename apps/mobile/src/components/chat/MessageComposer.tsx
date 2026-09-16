import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { ArrowUp, Mic, Paperclip, Wrench } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { useAuth } from '../../lib/auth/AuthProvider';
import { GlassCard } from '../ui';

interface ToolInfo {
  name: string;
}

interface UploadedDocument {
  title: string;
}

interface MessageComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  /** True while a reply is being generated - disables Send and shows a spinner instead of blocking silently. */
  streaming?: boolean;
}

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];

// Shared by Home and Chat, same reasoning as web's MessageComposer: the document-attach and
// tool-count wiring live in exactly one place instead of two copies drifting apart. Visually
// this is the Stitch "Interactive Input Dock" - a Tier 3 floating glass pill.
export function MessageComposer({ draft, onDraftChange, onSend, streaming = false }: MessageComposerProps) {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  // HomeStack (Home/Chat) is nested inside MainTabNavigator, which is nested inside the root
  // Stack - one parent hop reaches the Tools tab, two reach the root Stack's VoiceOverlay.
  const navigation = useNavigation<any>();
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    authFetch<ToolInfo[]>('/tools')
      .then((tools) => setToolCount(tools.length))
      .catch(() => setToolCount(null));
  }, [authFetch]);

  const onAttach = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_MIME_TYPES, copyToCacheDirectory: true });
    if (result.canceled || result.assets.length === 0) return;
    const file = result.assets[0];

    setUploadStatus(`Uploading ${file.name}…`);
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType ?? 'application/octet-stream',
    } as unknown as Blob);
    try {
      const doc = await authFetch<UploadedDocument>('/documents', { method: 'POST', body: formData });
      setUploadStatus(`Added "${doc.title}" to your knowledge base`);
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : `Could not upload "${file.name}".`);
    } finally {
      setTimeout(() => setUploadStatus(null), 4000);
    }
  };

  const onOpenTools = () => {
    navigation.getParent()?.navigate('Tools');
  };

  const onOpenVoice = () => {
    navigation.getParent()?.getParent()?.navigate('VoiceOverlay');
  };

  const canSend = draft.trim().length > 0;

  return (
    <View>
      {uploadStatus ? (
        <Text style={[styles.uploadStatus, { color: colors.tx3, fontFamily: fonts.body }]}>{uploadStatus}</Text>
      ) : null}
      <GlassCard tier={3} borderRadius={radius.full} style={styles.card}>
        <TextInput
          value={draft}
          onChangeText={onDraftChange}
          multiline
          placeholder="Ask FRIDAY anything…"
          placeholderTextColor={colors.tx5}
          style={[styles.input, { color: colors.tx, fontFamily: fonts.body }]}
        />
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => void onAttach()}
            style={[styles.iconButton, { borderColor: colors.line2 }]}
            accessibilityLabel="Attach a document to your knowledge base"
          >
            <Paperclip size={16} color={colors.tx2} />
          </Pressable>
          <Pressable onPress={onOpenTools} style={[styles.toolsButton, { borderColor: colors.line2 }]}>
            <Wrench size={14} color={colors.tx2} />
            {toolCount !== null ? (
              <Text style={[styles.toolsCount, { color: colors.ac, fontFamily: fonts.mono }]}>{toolCount}</Text>
            ) : null}
          </Pressable>
          <View style={styles.spacer} />
          {canSend ? (
            <Pressable
              onPress={onSend}
              disabled={streaming}
              style={[styles.sendButton, { backgroundColor: colors.ac, opacity: streaming ? 0.7 : 1 }]}
            >
              {streaming ? <ActivityIndicator size="small" color={colors.acFg} /> : <ArrowUp size={18} color={colors.acFg} />}
            </Pressable>
          ) : (
            <Pressable
              onPress={onOpenVoice}
              style={[styles.iconButton, { borderColor: colors.acL, backgroundColor: colors.acS }]}
              accessibilityLabel="Voice mode"
            >
              <Mic size={16} color={colors.ac} />
            </Pressable>
          )}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  uploadStatus: {
    fontSize: 12.5,
    marginBottom: spacing.xs,
  },
  card: {},
  input: {
    minHeight: 52,
    maxHeight: 160,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
    fontSize: 14.5,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    height: 36,
    width: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  toolsCount: {
    fontSize: 11,
  },
  spacer: {
    flex: 1,
  },
  sendButton: {
    height: 36,
    width: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
