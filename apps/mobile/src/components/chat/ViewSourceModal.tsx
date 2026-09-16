import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';

export function ViewSourceModal({ text, onClose }: { text: string | null; onClose: () => void }) {
  const { colors } = useTheme();

  const copy = async () => {
    await Clipboard.setStringAsync(text ?? '');
    Toast.show({ type: 'success', text1: 'Source copied to clipboard' });
  };

  return (
    <Modal visible={text !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }]}>
          <Text style={[styles.title, { color: colors.tx, fontFamily: fonts.heading }]}>Response source</Text>
          <Text style={[styles.subtitle, { color: colors.tx3, fontFamily: fonts.body }]}>
            The raw markdown behind this response.
          </Text>
          <ScrollView style={[styles.sourceBox, { borderColor: colors.line, backgroundColor: colors.bubble }]}>
            <Text style={[styles.sourceText, { color: colors.tx, fontFamily: fonts.mono }]}>{text}</Text>
          </ScrollView>
          <Pressable onPress={() => void copy()} style={[styles.copyButton, { borderColor: colors.line2 }]}>
            <Text style={[styles.copyText, { color: colors.tx2, fontFamily: fonts.body }]}>Copy</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  sourceBox: {
    maxHeight: 320,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  sourceText: {
    fontSize: 12,
    lineHeight: 18,
  },
  copyButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  copyText: {
    fontSize: 13,
  },
});
