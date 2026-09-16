import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';
import { MarkdownMessage } from './MarkdownMessage';
import { MessageActionSheet } from './MessageActionSheet';
import type { MessageAction } from './MessageActionSheet';
import { stripMarkdownForSpeech } from '../../lib/tts/stripMarkdownForSpeech';
import { Orb } from '../orb/Orb';
import type { ChatMessage } from '../../types';

interface ChatMessageItemProps {
  message: ChatMessage;
  isLast: boolean;
  streaming: boolean;
  onEditResend: (text: string) => void;
  onViewSource: (text: string) => void;
}

export function ChatMessageItem({ message, isLast, streaming, onEditResend, onViewSource }: ChatMessageItemProps) {
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  useEffect(
    () => () => {
      if (speakingRef.current) void Speech.stop();
    },
    [],
  );

  const copy = async () => {
    await Clipboard.setStringAsync(message.text);
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
  };

  const share = async () => {
    try {
      await Share.share({ message: message.text });
    } catch {
      // user cancelled - no toast needed
    }
  };

  const toggleSpeak = () => {
    if (speaking) {
      void Speech.stop();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    speakingRef.current = true;
    setSpeaking(true);
    Speech.speak(stripMarkdownForSpeech(message.text), {
      onDone: () => {
        speakingRef.current = false;
        setSpeaking(false);
      },
      onStopped: () => {
        speakingRef.current = false;
        setSpeaking(false);
      },
      onError: () => {
        speakingRef.current = false;
        setSpeaking(false);
      },
    });
  };

  const react = (value: 'up' | 'down') => {
    setReaction((prev) => (prev === value ? null : value));
    Toast.show({ type: 'success', text1: value === 'up' ? 'Thanks for the feedback!' : 'Thanks - noted for improvement.' });
  };

  const submitEdit = () => {
    const trimmed = editText.trim();
    setEditing(false);
    if (trimmed) onEditResend(trimmed);
  };

  if (message.role === 'user') {
    const actions: MessageAction[] = [
      { key: 'copy', label: 'Copy', onPress: () => void copy() },
      { key: 'share', label: 'Share', onPress: () => void share() },
      { key: 'edit', label: 'Edit', onPress: () => setEditing(true) },
    ];

    return (
      <View style={styles.userRow}>
        <View style={styles.userBubbleWrap}>
          {editing ? (
            <View style={[styles.bubble, { backgroundColor: colors.bubbleUser, borderColor: colors.glassBorderStrong }]}>
              <TextInput
                autoFocus
                multiline
                value={editText}
                onChangeText={setEditText}
                onBlur={() => setEditing(false)}
                style={[styles.bubbleText, { color: colors.tx, fontFamily: fonts.body }]}
              />
              <Pressable onPress={submitEdit} style={styles.editDone}>
                <Text style={{ color: colors.ac, fontFamily: fonts.bodyMedium, fontSize: 13 }}>Resend</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onLongPress={() => setSheetOpen(true)}
              style={[styles.bubble, { backgroundColor: colors.bubbleUser, borderColor: colors.glassBorderStrong }]}
            >
              <Text style={[styles.bubbleText, { color: colors.tx, fontFamily: fonts.body }]}>{message.text}</Text>
            </Pressable>
          )}
        </View>
        <MessageActionSheet visible={sheetOpen} actions={actions} onClose={() => setSheetOpen(false)} />
      </View>
    );
  }

  const showCursor = isLast && streaming && !message.errorMessage;
  const actionsEnabled = message.text.length > 0 && !(isLast && streaming) && !message.errorMessage;
  const actions: MessageAction[] = [
    { key: 'copy', label: 'Copy', onPress: () => void copy() },
    { key: 'up', label: reaction === 'up' ? 'Good response ✓' : 'Good response', onPress: () => react('up') },
    { key: 'down', label: reaction === 'down' ? 'Bad response ✓' : 'Bad response', onPress: () => react('down') },
    { key: 'read-aloud', label: speaking ? 'Stop reading' : 'Read aloud', onPress: toggleSpeak },
    { key: 'share', label: 'Share', onPress: () => void share() },
    { key: 'view-source', label: 'View source', onPress: () => onViewSource(message.text) },
  ];

  return (
    <Pressable
      onLongPress={() => actionsEnabled && setSheetOpen(true)}
      style={styles.assistantRow}
    >
      <Orb state={isLast && streaming ? 'thinking' : 'idle'} size="sm" style={styles.assistantOrb} />
      <View style={styles.assistantContent}>
        {message.text ? <MarkdownMessage text={message.text} /> : null}
        {showCursor ? <Text style={[styles.cursor, { color: colors.ac }]}>▌</Text> : null}
        {message.errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger, fontFamily: fonts.body }]}>
            {message.errorMessage}
          </Text>
        ) : null}
      </View>
      <MessageActionSheet visible={sheetOpen} actions={actions} onClose={() => setSheetOpen(false)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  userRow: {
    marginBottom: spacing.lg,
    alignItems: 'flex-end',
  },
  userBubbleWrap: {
    maxWidth: '80%',
    minWidth: 120,
  },
  bubble: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  editDone: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  assistantRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  assistantOrb: {
    marginTop: 2,
    flexShrink: 0,
  },
  assistantContent: {
    flex: 1,
    gap: spacing.xs,
  },
  cursor: {
    fontSize: 15,
  },
  errorText: {
    fontSize: 14.5,
    marginTop: spacing.xs,
  },
});
