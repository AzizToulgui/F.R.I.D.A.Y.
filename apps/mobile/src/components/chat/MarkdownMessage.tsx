import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts } from '../../theme/tokens';

// Ported from apps/web/src/components/MarkdownMessage.tsx - deliberately no syntax
// highlighting here either (same rationale as web: real added weight for a cosmetic gain),
// just themed monospace code blocks and GFM table/list support.
export function MarkdownMessage({ text }: { text: string }) {
  const { colors } = useTheme();

  return (
    <Markdown
      style={{
        body: { color: colors.tx, fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
        paragraph: { marginTop: 0, marginBottom: 8 },
        strong: { fontFamily: fonts.bodyMedium, color: colors.tx },
        heading1: { fontFamily: fonts.heading, fontSize: 18, color: colors.tx, marginTop: 4, marginBottom: 6 },
        heading2: { fontFamily: fonts.heading, fontSize: 16.5, color: colors.tx, marginTop: 4, marginBottom: 6 },
        heading3: { fontFamily: fonts.heading, fontSize: 15.5, color: colors.tx, marginTop: 4, marginBottom: 6 },
        link: { color: colors.ac, textDecorationLine: 'underline' },
        blockquote: {
          borderLeftWidth: 2,
          borderLeftColor: colors.line2,
          paddingLeft: 10,
          marginLeft: 0,
          backgroundColor: 'transparent',
        },
        blocklink: { color: colors.tx3 },
        hr: { backgroundColor: colors.line, height: 1 },
        bullet_list: { marginBottom: 8 },
        ordered_list: { marginBottom: 8 },
        list_item: { flexDirection: 'row' },
        code_inline: {
          backgroundColor: colors.bubble,
          color: colors.acTx,
          fontFamily: fonts.mono,
          fontSize: 13.5,
          borderRadius: 4,
          paddingHorizontal: 4,
        },
        code_block: {
          backgroundColor: colors.bubble,
          color: colors.tx,
          fontFamily: fonts.mono,
          fontSize: 12.5,
          borderRadius: 12,
          padding: 14,
        },
        fence: {
          backgroundColor: colors.bubble,
          color: colors.tx,
          fontFamily: fonts.mono,
          fontSize: 12.5,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.line,
        },
        table: { borderColor: colors.line, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
        th: {
          padding: 6,
          borderColor: colors.line,
          fontFamily: fonts.bodyMedium,
          color: colors.tx,
        },
        td: { padding: 6, borderColor: colors.line, color: colors.tx2 },
      }}
    >
      {text}
    </Markdown>
  );
}
