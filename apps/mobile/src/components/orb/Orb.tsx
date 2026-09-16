import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Rive, { Fit } from 'rive-react-native';
import type { RiveRef } from 'rive-react-native';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'asleep';
export type OrbSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<OrbSize, number> = {
  sm: 28,
  md: 64,
  lg: 132,
  xl: 280,
};

// Reuses the exact same remote Rive asset and state-machine wiring as web's Persona component
// (apps/web/src/components/ai-elements/persona.tsx) — default "obsidian" variant, state
// machine "default", boolean inputs listening/thinking/speaking/asleep (idle = all false).
// No new asset was commissioned for mobile; this just points the RN Rive runtime at the same
// hosted .riv file so both platforms render the identical living orb.
const SOURCE_URL = 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/obsidian-2.0.riv';
const STATE_MACHINE = 'default';

interface OrbProps {
  state?: OrbState;
  size?: OrbSize;
  style?: StyleProp<ViewStyle>;
}

export function Orb({ state = 'idle', size = 'md', style }: OrbProps) {
  const riveRef = useRef<RiveRef>(null);
  const dimension = SIZES[size];

  useEffect(() => {
    const ref = riveRef.current;
    if (!ref) return;
    ref.setInputState(STATE_MACHINE, 'listening', state === 'listening');
    ref.setInputState(STATE_MACHINE, 'thinking', state === 'thinking');
    ref.setInputState(STATE_MACHINE, 'speaking', state === 'speaking');
    ref.setInputState(STATE_MACHINE, 'asleep', state === 'asleep');
  }, [state]);

  return (
    <View style={[{ height: dimension, width: dimension }, style]}>
      <Rive
        ref={riveRef}
        url={SOURCE_URL}
        stateMachineName={STATE_MACHINE}
        autoplay
        fit={Fit.Contain}
        style={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
