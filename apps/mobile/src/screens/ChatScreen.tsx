import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, spacing } from '../theme/tokens';
import { useChatContext } from '../lib/chat/ChatProvider';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { MessageComposer } from '../components/chat/MessageComposer';
import { ViewSourceModal } from '../components/chat/ViewSourceModal';

const NEAR_BOTTOM_THRESHOLD = 80;

export function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { msgs, streaming, error, send } = useChatContext();
  const [draft, setDraft] = useState('');
  const [sourceText, setSourceText] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isNearBottomRef = useRef(true);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    isNearBottomRef.current =
      contentSize.height - contentOffset.y - layoutMeasurement.height < NEAR_BOTTOM_THRESHOLD;
  };

  const onContentSizeChange = () => {
    if (isNearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true });
  };

  const onSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;
    setDraft('');
    void send(trimmed);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.messages}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={onContentSizeChange}
        keyboardShouldPersistTaps="handled"
      >
        {msgs.map((m, i) => (
          <ChatMessageItem
            key={i}
            message={m}
            isLast={i === msgs.length - 1}
            streaming={streaming}
            onEditResend={(text) => void send(text)}
            onViewSource={setSourceText}
          />
        ))}
      </ScrollView>

      <View
        style={[
          styles.composerWrap,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.islandBottomOffset },
        ]}
      >
        {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}
        <MessageComposer draft={draft} onDraftChange={setDraft} onSend={onSubmit} streaming={streaming} />
        <Text style={[styles.disclaimer, { color: colors.tx4, fontFamily: fonts.body }]}>
          FRIDAY can make mistakes. Verify important details.
        </Text>
      </View>

      <ViewSourceModal text={sourceText} onClose={() => setSourceText(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  messages: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  composerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  error: {
    fontSize: 12.5,
    marginBottom: spacing.sm,
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
