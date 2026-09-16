import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CircleCheckBig, FileText, Trash, Upload } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, radius, spacing, type } from '../theme/tokens';
import { useAuth } from '../lib/auth/AuthProvider';
import { GlassCard, StatusChip } from '../components/ui';

type DocStatus = 'indexing' | 'indexed' | 'error';

interface DocItem {
  id: string;
  title: string;
  format: string;
  status: DocStatus;
  errorMessage: string | null;
  chunkCount: number;
  sizeBytes: number;
}

const POLL_INTERVAL_MS = 3000;
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeScreen() {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const docsRef = useRef(docs);
  docsRef.current = docs;

  const load = useCallback(async () => {
    try {
      const result = await authFetch<DocItem[]>('/documents');
      setDocs(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keeps status/chunkCount fresh while the background indexing job runs - stops polling
  // once nothing is left in the 'indexing' state.
  useEffect(() => {
    if (!docs.some((d) => d.status === 'indexing')) return;
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [docs, load]);

  const upload = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_MIME_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;

    setError(null);
    setUploading(true);
    try {
      for (const file of result.assets) {
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
        try {
          const created = await authFetch<DocItem>('/documents', { method: 'POST', body: formData });
          setDocs((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
        } catch (e) {
          setError(e instanceof Error ? e.message : `Could not upload "${file.name}".`);
        }
      }
    } finally {
      setUploading(false);
    }
  }, [authFetch]);

  const remove = useCallback(
    (id: string) => {
      const previous = docsRef.current;
      setDocs((prev) => prev.filter((d) => d.id !== id));
      authFetch(`/documents/${id}`, { method: 'DELETE' }).catch((e) => {
        setDocs(previous);
        setError(e instanceof Error ? e.message : 'Could not delete that document.');
      });
    },
    [authFetch],
  );

  const confirmRemove = (doc: DocItem) => {
    Alert.alert('Remove document?', `"${doc.title}" will no longer be searchable by FRIDAY.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(doc.id) },
    ]);
  };

  return (
    <ScrollView style={[styles.flex, { backgroundColor: colors.bg }]} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[type.headlineLg, { color: colors.tx, fontFamily: fonts.heading }]}>Knowledge</Text>
          <Text style={[type.bodySm, styles.subtitle, { color: colors.tx3 }]}>
            Documents FRIDAY can retrieve from during conversations. Answers cite the document (and section) they
            came from.
          </Text>
        </View>
        <StatusChip label={`${docs.length} docs`} tone={docs.some((d) => d.status === 'indexing') ? 'active' : 'neutral'} />
      </View>

      <Pressable onPress={() => void upload()} disabled={uploading}>
        <GlassCard tier={2} style={[styles.uploadZone, uploading && styles.disabled]} borderRadius={radius.xl}>
          <Upload size={20} color={colors.ac} />
          <Text style={[styles.uploadText, { color: colors.ac, fontFamily: fonts.bodyMedium }]}>
            {uploading ? 'Uploading…' : 'Tap to upload documents'}
          </Text>
          <Text style={[metaLabelStyle, styles.uploadHint, { color: colors.tx4 }]}>PDF · DOCX · MD · TXT</Text>
        </GlassCard>
      </Pressable>

      {error ? <Text style={[styles.error, { color: colors.danger, fontFamily: fonts.body }]}>{error}</Text> : null}

      {loading ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>Loading documents…</Text>
      ) : docs.length === 0 ? (
        <Text style={[styles.empty, { color: colors.tx3, fontFamily: fonts.body }]}>
          Nothing uploaded yet - tap above to get started.
        </Text>
      ) : (
        <View style={styles.list}>
          {docs.map((d) => (
            <GlassCard
              key={d.id}
              tier={2}
              style={[
                styles.card,
                d.status === 'error' && { backgroundColor: colors.dangerBg, borderColor: colors.dangerLine },
                d.status === 'indexing' && { backgroundColor: colors.acXs, borderColor: colors.acM },
              ]}
            >
              <View style={styles.cardRow}>
                <View style={[styles.fileIcon, { borderColor: colors.line2 }]}>
                  <FileText size={16} color={colors.tx3} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.title, { color: colors.tx, fontFamily: fonts.body }]} numberOfLines={1}>
                    {d.title}
                  </Text>
                  {d.status === 'error' ? (
                    <Text style={[styles.errorLine, { color: colors.danger, fontFamily: fonts.body }]}>
                      {d.errorMessage ?? "Couldn't process this file."}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        metaLabelStyle,
                        styles.metaLine,
                        { color: d.status === 'indexing' ? colors.ac : colors.tx4 },
                      ]}
                    >
                      {formatSize(d.sizeBytes)} · {d.format.toUpperCase()}
                      {d.status === 'indexed' ? ` · ${d.chunkCount} CHUNKS` : ' · INDEXING…'}
                    </Text>
                  )}
                </View>
                {d.status === 'indexed' ? <CircleCheckBig size={16} color={colors.ok} /> : null}
              </View>
              <Pressable onPress={() => confirmRemove(d)} style={styles.removeButton}>
                <Trash size={13} color={colors.tx3} />
                <Text style={[styles.removeText, { color: colors.tx3, fontFamily: fonts.body }]}>Remove</Text>
              </Pressable>
            </GlassCard>
          ))}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginTop: spacing.sm,
    maxWidth: 480,
  },
  uploadZone: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  uploadText: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  uploadHint: {},
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  fileIcon: {
    height: 36,
    width: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
  },
  errorLine: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  metaLine: {
    marginTop: spacing.xs,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
  },
  removeText: {
    fontSize: 13,
  },
});
