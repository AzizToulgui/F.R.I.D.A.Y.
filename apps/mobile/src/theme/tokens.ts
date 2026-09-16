// Redesigned to match the Stitch "Premium AI App Redesign" project (Friday Mobile design
// system, project 18304479919015752346). This is an INTENTIONAL, mobile-only divergence from
// apps/web/src/app/globals.css — web keeps its current single-cyan-accent palette for now.
// Do not "sync" these two files without an explicit decision to redesign web too.
//
// Key names are kept where the old palette already had a matching role (bg/tx/line/ac.../
// danger/ok) so most existing screens only need re-coloring, not renaming. New keys (ac2, ac3,
// glass*) are additive for the new tri-accent, multi-layer-glass system.

export interface ColorTokens {
  bg: string;
  bg2: string;
  bgVoice: string;
  panel: string;
  panel2: string;
  bubble: string;
  bubbleUser: string;

  tx: string;
  tx2: string;
  tx3: string;
  tx4: string;
  tx5: string;

  line: string;
  line2: string;
  line3: string;

  ac: string;
  acHi: string;
  acFg: string;
  acTx: string;
  acL: string;
  acM: string;
  acS: string;
  acXs: string;

  // Secondary accent — cyan luster: specular energy, real-time processing indicators.
  ac2: string;
  // Tertiary accent — luminous violet: multimodal/deep-synthesis indicators.
  ac3: string;
  // Primary button / orb-glow gradient stops (135deg azure -> deep blue per DESIGN.md).
  acGradient: readonly [string, string];

  // Multi-layer glassmorphism (Tier 2/3 in DESIGN.md's elevation system). Pair with
  // expo-blur's BlurView (see blur.card/dock/sheet below) — these are the tint fills that
  // sit on top of the blur, not blur amounts themselves.
  glassFill: string;
  glassFillStrong: string;
  glassBorder: string;
  glassBorderStrong: string;

  danger: string;
  dangerLine: string;
  dangerBg: string;
  ok: string;
}

export const darkColors: ColorTokens = {
  bg: '#05070b',
  bg2: '#0a0e17',
  bgVoice: '#020304',
  panel: '#0e1420',
  panel2: '#12192a',
  bubble: '#161d2e',
  bubbleUser: 'rgba(56, 182, 255, 0.12)',

  tx: '#f8fafc',
  tx2: '#c3ccda',
  tx3: '#94a3b8',
  tx4: '#6b7a90',
  tx5: '#475569',

  line: 'rgba(255, 255, 255, 0.08)',
  line2: 'rgba(255, 255, 255, 0.12)',
  line3: 'rgba(255, 255, 255, 0.22)',

  ac: '#38b6ff',
  acHi: '#5fd8ff',
  acFg: '#f8fafc',
  acTx: '#5fd8ff',
  acL: 'rgba(56, 182, 255, 0.5)',
  acM: 'rgba(56, 182, 255, 0.3)',
  acS: 'rgba(56, 182, 255, 0.12)',
  acXs: 'rgba(56, 182, 255, 0.06)',

  ac2: '#5fd8ff',
  ac3: '#a78bfa',
  acGradient: ['#38b6ff', '#1d4ed8'],

  glassFill: 'rgba(14, 20, 32, 0.65)',
  glassFillStrong: 'rgba(18, 26, 42, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderStrong: 'rgba(95, 216, 255, 0.2)',

  danger: '#ffb4ab',
  dangerLine: 'rgba(255, 180, 171, 0.28)',
  dangerBg: 'rgba(147, 0, 10, 0.2)',
  ok: '#6ee7b7',
};

export const lightColors: ColorTokens = {
  bg: '#f7f8fc',
  bg2: '#eef1f7',
  bgVoice: '#f2f5fa',
  panel: '#ffffff',
  panel2: '#ffffff',
  bubble: '#eaf0f8',
  bubbleUser: 'rgba(11, 126, 200, 0.08)',

  tx: '#0b1220',
  tx2: '#334155',
  tx3: '#5b6b82',
  tx4: '#7c8aa0',
  tx5: '#9aa7bc',

  line: 'rgba(15, 23, 42, 0.08)',
  line2: 'rgba(15, 23, 42, 0.14)',
  line3: 'rgba(15, 23, 42, 0.28)',

  ac: '#0b7ec8',
  acHi: '#0a6aa8',
  acFg: '#ffffff',
  acTx: '#0a6aa8',
  acL: 'rgba(11, 126, 200, 0.5)',
  acM: 'rgba(11, 126, 200, 0.3)',
  acS: 'rgba(11, 126, 200, 0.12)',
  acXs: 'rgba(11, 126, 200, 0.06)',

  ac2: '#0e93ae',
  ac3: '#7c5ce0',
  acGradient: ['#0b7ec8', '#0a3d91'],

  glassFill: 'rgba(255, 255, 255, 0.65)',
  glassFillStrong: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(15, 23, 42, 0.08)',
  glassBorderStrong: 'rgba(10, 143, 188, 0.25)',

  danger: '#c0392b',
  dangerLine: 'rgba(192, 57, 43, 0.25)',
  dangerBg: 'rgba(192, 57, 43, 0.06)',
  ok: '#1e8a4c',
};

// Web loads these via next/font/google as CSS custom properties. Mobile loads the same
// families via @expo-google-fonts/* and expo-font in ThemeProvider - these names must match
// the family names registered with Font.loadAsync there. Headline weight is now Geist
// SemiBold (Space Grotesk dropped) per the Stitch redesign.
export const fonts = {
  heading: 'Geist_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  safeMargin: 20,
  islandBottomOffset: 88,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

// expo-blur BlurView `intensity` values (0-100) approximating the CSS backdrop-filter blur
// radii in the Stitch DESIGN.md elevation tiers - not a 1:1 px mapping, tuned to look right
// on-device since RN's blur falloff differs from CSS.
export const blur = {
  card: 40, // Tier 2 glass containers (~28px CSS blur)
  dock: 55, // Tier 3 floating input dock / tab bar (~40px CSS blur)
  sheet: 65, // bottom sheets / drawer-style screens (~32px CSS blur, boosted for legibility)
} as const;

// Type scale from the Stitch DESIGN.md. letterSpacing here is in px (RN convention), roughly
// converted from the source's em values against each size.
export const type = {
  headlineXl: { fontFamily: fonts.heading, fontSize: 36, fontWeight: '600', lineHeight: 42, letterSpacing: -1.1 },
  headlineXlMobile: { fontFamily: fonts.heading, fontSize: 28, fontWeight: '600', lineHeight: 34, letterSpacing: -0.7 },
  headlineLg: { fontFamily: fonts.heading, fontSize: 24, fontWeight: '600', lineHeight: 30, letterSpacing: -0.48 },
  headlineMd: { fontFamily: fonts.heading, fontSize: 20, fontWeight: '500', lineHeight: 26, letterSpacing: -0.3 },
  bodyLg: { fontFamily: fonts.body, fontSize: 17, fontWeight: '400', lineHeight: 24, letterSpacing: -0.17 },
  bodyMd: { fontFamily: fonts.body, fontSize: 15, fontWeight: '400', lineHeight: 22, letterSpacing: -0.08 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: 0 },
  codeInline: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '400', lineHeight: 18, letterSpacing: -0.13 },
} as const;

// Tracked-out uppercase mono labels (date-group headers, status badges, voice-overlay
// sub-labels, memory timestamps, doc format/size lines) - a consistent secondary-text idiom,
// shared as a style fragment rather than repeated per-screen.
export const metaLabelStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
};

// Status/telemetry chip label (label-status in DESIGN.md) — slightly bolder/smaller than
// metaLabelStyle, used inside StatusChip.
export const labelStatusStyle = {
  fontFamily: fonts.monoMedium,
  fontSize: 11,
  letterSpacing: 0.9,
  textTransform: 'uppercase' as const,
};
