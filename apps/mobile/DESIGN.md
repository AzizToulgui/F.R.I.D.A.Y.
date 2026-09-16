# Design System: FRIDAY Mobile (current state)

This describes the design system as implemented today in `apps/mobile` (Expo/React Native), following the "Premium AI App Redesign" pass (Stitch project `18304479919015752346`). It replaced the earlier single-cyan, flat-card system documented in this file's previous revision. **This is mobile-only** — `apps/web` still runs its original palette; `src/theme/tokens.ts` intentionally diverges from `apps/web/src/app/globals.css` for now.

## 1. Visual Theme & Atmosphere

An OLED-dark, multi-layer-glassmorphism "living intelligence" aesthetic. Near-black void backgrounds (`#05070b`), a tri-accent chromatic system (azure/cyan/violet) instead of the old single cyan, and a real animated orb as the brand mark instead of a static concentric-ring placeholder. The feel is atmospheric and optical — glass surfaces, specular borders, soft glow — rather than clinical/flat.

- **Density:** unchanged, moderate (generous padding, floating cards).
- **Variance:** raised from the old system — asymmetric feed cards on Home, a full-screen orb takeover for Voice, a floating pill dock instead of a flush composer bar.
- **Motion:** meaningfully increased — press-scale springs on `Button` (`src/components/ui/Button.tsx`, via `react-native-reanimated`), a waveform on the Voice screen, and a real state-driven orb animation (`src/components/orb/Orb.tsx`). Reanimated 4/Worklets, previously installed-but-unused, is now load-bearing.

Dark is the only fully-designed mode; light mode keeps structural parity (see `lightColors` in `src/theme/tokens.ts`) but was derived, not part of the original Stitch mock.

## 2. Color Palette & Roles

Defined in `src/theme/tokens.ts` (`darkColors` / `lightColors`, type `ColorTokens`). Old key names were kept where the role matched (`bg`, `tx*`, `line*`, `ac*`, `danger*`, `ok`) so most screens only needed re-coloring; new keys are additive.

- **Root void** (`#05070b`) — `bg`
- **Surface canvas** (`#0a0e17`) — `bg2`
- **Voice overlay background** (`#020304`) — `bgVoice`
- **Solid panel fills** (`#0e1420` / `#12192a`) — `panel` / `panel2`, used where an opaque background is required (nav headers, drawer-style screens)
- **Glass tint fills** — `glassFill` (`rgba(14,20,32,0.65)`, Tier 2) / `glassFillStrong` (`rgba(18,26,42,0.85)`, Tier 3), paired with `glassBorder` / `glassBorderStrong`. These sit on top of an `expo-blur` `BlurView` inside `GlassCard` (see §4).
- **Primary accent — Electric Azure** (`#38b6ff`) — `ac` and its opacity ramp `acHi/acFg/acTx/acL/acM/acS/acXs`, same roles as the old single-accent system (buttons, focus, active nav).
- **Secondary accent — Cyan Luster** (`#5fd8ff`) — `ac2`, specular/processing highlights.
- **Tertiary accent — Luminous Violet** (`#a78bfa`) — `ac3`, multimodal/deep-synthesis indicators (used for the "thinking" caption label on Voice, the Vault status accents).
- **Primary button/orb gradient** — `acGradient: [azure, deepBlue]`, consumed by `Button`'s primary variant via `expo-linear-gradient`.
- **Danger/Ok** — same roles as before, values refreshed to fit the darker base (`danger:#ffb4ab`, `ok:#6ee7b7`).

Light mode mirrors every role with darkened/saturated accents for contrast on white (see `lightColors`); it was authored to preserve structure, not pulled from a Stitch light mock (none exists).

## 3. Typography Rules

Fonts loaded in `ThemeProvider.tsx`. **Space Grotesk was dropped** — headings now use Geist SemiBold instead of a separate display face:

- **Heading:** `Geist_600SemiBold` — screen titles, section headers. Sizes per the `type` scale in `tokens.ts` (`headlineXl` 36 / `headlineLg` 24 / `headlineMd` 20).
- **Body:** `Geist_400Regular`, medium `Geist_500Medium` — everything else, per `type.bodyLg/bodyMd/bodySm`.
- **Mono:** `JetBrainsMono_400Regular` / `_500Medium` — unchanged idiom: tracked-out uppercase labels (`metaLabelStyle`) for meta/status/date-group text, now joined by `labelStatusStyle` for the new `StatusChip` component.

## 4. Component Stylings

A small shared primitive layer now exists at `src/components/ui/` (there wasn't one before — the old system was deliberately hand-rolled-only; this is additive, nothing broke):

- **`GlassCard`** (`tier` 1/2/3) — the base surface for nearly every card/row/dock across the app. Tier 2 = standard content card (`BlurView` + `glassFill` tint). Tier 3 = floating command dock (stronger blur, accent-tinted border) — used by `MessageComposer`. `style` merges onto the single content view, so callers can pass `flexDirection`/`padding`/`gap`/sizing and have it apply to the actual layout, not just outer sizing.
- **`Button`** (`primary` / `secondary` / `destructive`) — primary is a full-pill `acGradient` fill with a press-scale spring; secondary/destructive are translucent glass pills. Replaces most raw `Pressable` + `Text` button pairs.
- **`StatusChip`** — mono-uppercase pill + LED dot, tone-keyed (`ok`/`active`/`synthesis`/`danger`/`neutral`). Used for live counts (Memory's indexed count, Knowledge's doc count, the Intelligence Drawer's connected-engines summary, Voice's listening/thinking/speaking label).
- **`SegmentedControl`** — pill-track tab switcher, available for future use (Settings kept its horizontal-scroll tab bar, now restyled as individual pill chips rather than adopting this component, since it needed horizontal overflow scrolling).
- **`Orb`** (`src/components/orb/Orb.tsx`) — the brand mark, wrapping `rive-react-native` pointed at the *same remote `.riv` asset* web's `Persona` component uses (`obsidian-2.0.riv`, state machine `"default"`, boolean inputs `listening/thinking/speaking/asleep`). No new art was commissioned; mobile and web now render the identical living orb. Used at three sizes: `sm` (Chat message avatar, Intelligence Drawer header), `lg` (Home hero), `xl` (Voice full-screen).
- **Icons** — `lucide-react-native` (+ `react-native-svg`) replaces the old Unicode-glyph/letter-badge convention everywhere (tab bar, Tools groups, Memory/Knowledge actions, Voice controls, composer toolbar).
- **Switch / Modal / Alert.alert usage** — unchanged from the old system.

## 5. Layout Principles

- **Navigation is bottom tabs, not a drawer.** `MainTabNavigator.tsx` (`@react-navigation/bottom-tabs`) replaced `MainDrawerNavigator`/`DrawerContent` entirely: Hub (Home/Chat stack) / Memory / a non-navigating center Voice button / Tools / Settings. The tab bar floats (`position:'absolute'`, blurred background) — every tab-hosted screen's scroll content must pad its bottom by `spacing.islandBottomOffset` (88px) to clear it; screens reached by push instead (Knowledge, Reminders, Notes, the Intelligence Drawer) don't need this since they get a normal opaque header.
- Chat history + "new conversation" moved from the old slide-out drawer into `IntelligenceDrawerScreen.tsx`, a normal pushed/modal screen (the Stitch "Intelligence Drawer & Tool Hub" mock) reached via a header menu icon on Home/Chat.
- Settings moved from a modal (`SettingsModal.tsx`) to a real tab screen (renamed `SettingsScreen.tsx`).
- Single-column stacking, safe-area handling, and the general "phone app, not responsive web" posture are unchanged from before.

## 6. Motion & Interaction

No longer "effectively none." `react-native-reanimated` is now used for: `Button` press-scale springs, the Voice screen's waveform bars, and the `Orb`'s state machine playback (idle/listening/thinking/speaking/asleep) driven declaratively via a `state` prop.

## 7. Notes / Follow-ups

- **Voice overlay is a visual shell.** `VoiceOverlayModal.tsx` cycles the orb through demo states on a timer — there's no live Gemini audio stream wired to it yet (same gap the pre-redesign stub flagged). Wiring real mic capture/streaming to `Orb`'s `state` prop is a follow-up, not part of this redesign pass.
- **Home's "Synthesized Focus" feed** is visually from the Stitch mock but intentionally backed by real prompt-starters (same content the old suggestion grid used), not fabricated agent-activity data — there's no live agent/PR/email feed behind it.
- **Memory/Knowledge stayed separate screens** (not merged into one "Vault" route) per an explicit scope decision, each independently reskinned with the vault visual language (status chip counts, glass card rows).
- Two full themes must stay in sync — `darkColors`/`lightColors` in `tokens.ts` remain hand-maintained parallel objects.
- `rive-react-native` is a native module: the app needs a custom dev client (`npx expo prebuild` + `run:ios`/`run:android`), not plain Expo Go.
