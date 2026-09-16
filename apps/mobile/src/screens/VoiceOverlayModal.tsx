import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ChevronLeft, Eye, Lock, Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, metaLabelStyle, spacing, type } from '../theme/tokens';
import { Orb } from '../components/orb/Orb';
import type { OrbState } from '../components/orb/Orb';
import { StatusChip } from '../components/ui';

// Real-time Gemini Live audio capture isn't wired up on mobile yet (see the web VoiceOverlay
// for that flow) - this ships the full "Voice - Ambient Intelligence" visual shell from the
// Stitch mock, cycling through the orb's demo states so the screen doesn't look inert. Wiring
// this to a live mic stream is a follow-up, not part of this redesign pass.
const DEMO_CAPTION = '…and orchestrate the deployment across our European cluster while maintaining zero downtime.';
const DEMO_CYCLE: { state: OrbState; label: string }[] = [
  { state: 'listening', label: 'LISTENING' },
  { state: 'thinking', label: 'SYNTHESIZING TOPOLOGY' },
  { state: 'speaking', label: 'RESPONDING' },
];

function WaveformBar({ index, active }: { index: number; active: boolean }) {
  const { colors } = useTheme();
  const height = useSharedValue(6);

  useEffect(() => {
    if (!active) {
      height.value = withTiming(6, { duration: 200 });
      return;
    }
    height.value = withRepeat(
      withSequence(
        withTiming(10 + Math.random() * 22, { duration: 260 + index * 30 }),
        withTiming(6 + Math.random() * 10, { duration: 260 + index * 20 }),
      ),
      -1,
      true,
    );
  }, [active, height, index]);

  const style = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[styles.waveBar, style, { backgroundColor: colors.ac }]} />;
}

export function VoiceOverlayModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [cycleIndex, setCycleIndex] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setCycleIndex((i) => (i + 1) % DEMO_CYCLE.length), 3200);
    return () => clearInterval(id);
  }, []);

  const current = micOn ? DEMO_CYCLE[cycleIndex] : { state: 'idle' as OrbState, label: 'MUTED' };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bgVoice, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => navigation.goBack()}>
          <ChevronLeft color={colors.tx2} size={22} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={[type.headlineMd, { color: colors.tx, fontFamily: fonts.heading }]}>Voice Ambient Intelligence</Text>
          <View style={styles.headerStatusRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.ac }]} />
            <Text style={[metaLabelStyle, { color: colors.tx4 }]}>Active Task</Text>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.chipRow}>
        <StatusChip label={current.label} tone={micOn ? 'active' : 'neutral'} />
        <View style={styles.encryptedChip}>
          <Lock size={11} color={colors.tx4} />
          <Text style={[metaLabelStyle, { color: colors.tx4 }]}>256-bit encrypted</Text>
        </View>
      </View>

      {cameraOn ? (
        <View style={styles.visionRow}>
          <Eye size={13} color={colors.ac3} />
          <Text style={[type.bodySm, { color: colors.tx3, fontFamily: fonts.body }]}>
            Camera vision active — analyzing surroundings
          </Text>
        </View>
      ) : null}

      <View style={styles.orbArea}>
        <Orb state={current.state} size="xl" />
        <View style={styles.waveform}>
          {Array.from({ length: 9 }).map((_, i) => (
            <WaveformBar key={i} index={i} active={micOn && current.state !== 'idle'} />
          ))}
        </View>
      </View>

      <View style={styles.captionArea}>
        <Text style={[type.headlineMd, styles.caption, { color: colors.tx, fontFamily: fonts.heading }]}>
          &ldquo;{DEMO_CAPTION}&rdquo;
        </Text>
        <Text style={[metaLabelStyle, styles.captionLabel, { color: colors.ac3 }]}>{current.label}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => setCameraOn((v) => !v)}
          style={[styles.controlButton, { borderColor: colors.line2, backgroundColor: colors.glassFill }]}
        >
          {cameraOn ? <Video size={20} color={colors.tx2} /> : <VideoOff size={20} color={colors.tx4} />}
        </Pressable>
        <Pressable
          onPress={() => setMicOn((v) => !v)}
          style={[styles.micButton, { backgroundColor: micOn ? colors.ac : colors.glassFillStrong, borderColor: colors.acL }]}
        >
          {micOn ? <Mic size={24} color={colors.acFg} /> : <MicOff size={24} color={colors.tx3} />}
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={[styles.controlButton, { backgroundColor: colors.dangerBg, borderColor: colors.dangerLine }]}>
          <PhoneOff size={20} color={colors.danger} />
        </Pressable>
      </View>

      <Text style={[styles.hint, { color: colors.tx4, fontFamily: fonts.body }]}>
        Tap the orb to interrupt or ask a follow-up
      </Text>
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
    paddingTop: spacing.sm,
  },
  headerTitle: {
    alignItems: 'center',
    gap: 4,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    height: 5,
    width: 5,
    borderRadius: 2.5,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  encryptedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  orbArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  captionArea: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  caption: {
    textAlign: 'center',
    fontSize: 19,
    lineHeight: 26,
  },
  captionLabel: {
    letterSpacing: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  controlButton: {
    height: 52,
    width: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    height: 68,
    width: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
