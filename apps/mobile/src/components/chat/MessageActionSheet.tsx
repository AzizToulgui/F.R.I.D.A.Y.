import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius, spacing } from '../../theme/tokens';

export interface MessageAction {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

// Long-press is the mobile equivalent of web's hover-reveal action row (Section 4.1) - this
// is the bottom-sheet it opens into, shared by user and assistant message bubbles.
export function MessageActionSheet({
  visible,
  actions,
  onClose,
}: {
  visible: boolean;
  actions: MessageAction[];
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheetWrap}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.panel, borderColor: colors.line }]}>
            {actions.map((action, i) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  action.onPress();
                  onClose();
                }}
                style={[styles.row, i > 0 && { borderTopColor: colors.line, borderTopWidth: 1 }]}
              >
                <Text
                  style={[
                    styles.rowText,
                    { color: action.destructive ? colors.danger : colors.tx, fontFamily: fonts.body },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    padding: spacing.lg,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowText: {
    fontSize: 15,
  },
});
