'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, Loader2Icon, PlayIcon, SquareIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth/AuthProvider';
import { applyTtsSettings, DEFAULT_TTS_SETTINGS, loadTtsSettings, saveTtsSettings, useSpeechVoices } from '@/lib/tts/ttsSettings';
import type { TtsSettings } from '@/lib/tts/ttsSettings';
import type { Theme } from '@/types';

interface SettingsViewProps {
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  onClose: () => void;
  initialTab?: string;
}

const NAV_ITEMS = ['Appearance', 'Account', 'Voice', 'Language', 'Memory', 'Privacy', 'Notifications', 'Security'];

interface Toggle {
  key: string;
  title: string;
  desc: string;
  defaultOn: boolean;
}

const TOGGLES: Toggle[] = [
  { key: 'matchSystem', title: 'Match system theme', desc: 'Follow your OS setting automatically.', defaultOn: false },
  { key: 'reduceOrb', title: 'Reduce orb motion', desc: 'Replaces the animated core with a static state indicator.', defaultOn: false },
  { key: 'highContrast', title: 'High contrast text', desc: 'Raises body copy to AAA contrast.', defaultOn: true },
];

interface Voice {
  name: string;
  description: string;
}

interface VoiceOptions {
  voices: Voice[];
  deliveryStyles: { key: string; label: string }[];
  sampleVersion: string;
}

interface VoiceSettings {
  voiceName: string | null;
  voiceDeliveryStyle: string | null;
}

// No "default" delivery-style item can carry an empty string value (Base
// UI's Select treats "" as "no selection"), so this sentinel stands in for
// null/unset and gets translated back at the call site.
const DELIVERY_STYLE_DEFAULT = 'default';

// Reads as a tiny live audio meter rather than a generic pause glyph -
// communicates "this is playing" more specifically for a voice-preview control.
function EqualizerIcon() {
  const bars = [-0.6, -0.3, 0];
  return (
    <span className="flex h-3 items-end gap-[2.5px]">
      {bars.map((delay) => (
        <span
          key={delay}
          className="h-full w-[2.5px] origin-bottom rounded-full bg-current [animation:jv-eq_0.9s_ease-in-out_infinite]"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
}

function AccountPanel() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch<GoogleStatus>('/google/status');
        if (!cancelled) setStatus(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load Google account status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await authFetch<{ url: string }>('/google/authorize/connect', { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Google sign-in.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await authFetch('/google', { method: 'DELETE' });
      setStatus({ connected: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect Google account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="m-0 mb-1 text-xl font-medium text-foreground">Account</h1>
      <p className="m-0 mb-5 text-sm text-muted-foreground">
        Connect Google to let JARVIS see unread email, manage your calendar, and search the web.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Checking connection…
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Google</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {status?.connected ? `Connected as ${status.email}` : 'Not connected'}
            </div>
          </div>
          {status?.connected ? (
            <Button type="button" variant="outline" disabled={busy} onClick={disconnect}>
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={connect}>
              {busy ? 'Redirecting…' : 'Connect'}
            </Button>
          )}
        </div>
      )}

      {error && <div className="mt-3 text-[12.5px] text-destructive">{error}</div>}
    </div>
  );
}

function VoicePanel() {
  const { authFetch, authFetchStream } = useAuth();
  const [options, setOptions] = useState<VoiceOptions | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>({ voiceName: null, voiceDeliveryStyle: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // One fetched clip per voice for the life of this panel - the backend
  // already caches the synthesis itself (see VoiceSamplesService), this just
  // saves the extra network round trip on a repeat play within one session.
  const sampleUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [opts, current] = await Promise.all([
          authFetch<VoiceOptions>('/users/voice-options'),
          authFetch<VoiceSettings>('/users/me/voice-settings'),
        ]);
        if (cancelled) return;
        setOptions(opts);
        setSettings(current);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load voice settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Revoke every object URL on unmount (e.g. closing Settings) - they'd
  // otherwise pin the audio blobs in memory for the rest of the tab's life.
  useEffect(() => {
    const urls = sampleUrlsRef.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, []);

  const update = async (patch: Partial<VoiceSettings>) => {
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await authFetch('/users/me/voice-settings', { method: 'PATCH', body: JSON.stringify(patch) });
    } catch (e) {
      setSettings(previous);
      setError(e instanceof Error ? e.message : 'Could not save that change.');
    }
  };

  const togglePreview = async (voiceName: string) => {
    const audio = (audioRef.current ??= new Audio());
    if (playingVoice === voiceName) {
      audio.pause();
      setPlayingVoice(null);
      return;
    }
    audio.pause();
    setError(null);

    // Keyed by sample text version too - if the sample wording changes (see
    // VoiceSamplesService.SAMPLE_VERSION), this is a different cache key, so
    // a voice already previewed this session doesn't keep replaying the old
    // wording's blob until the panel is reopened.
    const cacheKey = `${voiceName}:${options?.sampleVersion}`;
    let url = sampleUrlsRef.current.get(cacheKey);
    if (!url) {
      setLoadingVoice(voiceName);
      try {
        const res = await authFetchStream(
          `/users/voice-options/${encodeURIComponent(voiceName)}/sample?v=${options?.sampleVersion}`,
        );
        url = URL.createObjectURL(await res.blob());
        sampleUrlsRef.current.set(cacheKey, url);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not load a sample for ${voiceName}.`);
        setLoadingVoice(null);
        return;
      }
      setLoadingVoice(null);
    }

    audio.src = url;
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => setPlayingVoice(null);
    await audio.play();
    setPlayingVoice(voiceName);
  };

  return (
    <div>
      <h1 className="m-0 mb-1 text-xl font-medium text-foreground">Voice</h1>
      <p className="m-0 mb-5 text-sm text-muted-foreground">
        Applies to voice mode - Gemini&rsquo;s spoken voice and how it paces and phrases what it says.
      </p>

      {error && <div className="mb-3 text-sm text-destructive">{error}</div>}

      {loading || !options ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex flex-col">
          <div className="pb-2.5">
            <div className="text-sm font-medium text-foreground">Voice</div>
            <div className="mt-1 mb-1 text-sm text-muted-foreground">
              The prebuilt voice Gemini speaks with - preview one before picking it.
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              <div className="flex items-center gap-3 border-t py-2.5">
                <div className="w-8 flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground">Default</div>
                  <div className="text-xs text-muted-foreground">Gemini decides</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={settings.voiceName === null ? 'secondary' : 'outline'}
                  disabled={settings.voiceName === null}
                  onClick={() => void update({ voiceName: null })}
                >
                  {settings.voiceName === null ? 'Selected' : 'Select'}
                </Button>
              </div>
              {options.voices.map(({ name, description }) => {
                const isSelected = settings.voiceName === name;
                const isPlaying = playingVoice === name;
                const isLoadingSample = loadingVoice === name;
                return (
                  <div key={name} className="flex items-center gap-3 border-t py-2.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={isPlaying ? `Stop ${name} sample` : `Play ${name} sample`}
                      onClick={() => void togglePreview(name)}
                      disabled={isLoadingSample}
                      className={`rounded-full ${isPlaying ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
                    >
                      {isLoadingSample ? (
                        <Loader2Icon className="animate-spin" />
                      ) : isPlaying ? (
                        <EqualizerIcon />
                      ) : (
                        <PlayIcon className="translate-x-[1px]" />
                      )}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground">{name}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? 'secondary' : 'outline'}
                      disabled={isSelected}
                      onClick={() => void update({ voiceName: name })}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-b py-4">
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Delivery style</div>
              <div className="mt-1 text-sm text-muted-foreground">How JARVIS paces and phrases what it says out loud.</div>
            </div>
            <Select
              value={settings.voiceDeliveryStyle ?? DELIVERY_STYLE_DEFAULT}
              onValueChange={(value) =>
                void update({ voiceDeliveryStyle: value === DELIVERY_STYLE_DEFAULT ? null : (value as string) })
              }
            >
              <SelectTrigger aria-label="Delivery style" className="w-[180px]">
                {/* Base UI's SelectValue shows the raw value unless told how
                    to format it (unlike Radix, it doesn't read the matching
                    SelectItem's children back out) - so this maps the key to
                    its label explicitly. */}
                <SelectValue>
                  {(value: string) =>
                    value === DELIVERY_STYLE_DEFAULT
                      ? 'Default'
                      : (options.deliveryStyles.find((style) => style.key === value)?.label ?? 'Default')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DELIVERY_STYLE_DEFAULT}>Default</SelectItem>
                {options.deliveryStyles.map((style) => (
                  <SelectItem key={style.key} value={style.key}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

const PREVIEW_TEXT = "This is a preview of your read-aloud voice.";

/** Settings for the browser-native "Read aloud" button on chat responses - a separate TTS engine from JARVIS's own spoken voice above, so it gets its own controls and its own (client-only, localStorage-backed) settings. */
function ReadAloudPanel() {
  const voices = useSpeechVoices();
  const [settings, setSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [previewing, setPreviewing] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Loaded post-mount (not during render) to avoid an SSR/client hydration
  // mismatch, matching the pattern used for navigator.share detection
  // elsewhere - deferred via queueMicrotask for the same lint rule.
  useEffect(() => {
    queueMicrotask(() => setSettings(loadTtsSettings()));
  }, []);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const persist = (patch: Partial<TtsSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveTtsSettings(next);
      return next;
    });
  };

  const togglePreview = () => {
    if (!supported) return;
    if (previewing) {
      window.speechSynthesis.cancel();
      setPreviewing(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(PREVIEW_TEXT);
    applyTtsSettings(utterance, settings);
    utterance.onend = () => setPreviewing(false);
    utterance.onerror = () => setPreviewing(false);
    window.speechSynthesis.speak(utterance);
    setPreviewing(true);
  };

  return (
    <div className="mt-4 flex flex-col border-t pt-4">
      <div className="text-sm font-medium text-foreground">Read responses aloud</div>
      <div className="mt-1 mb-3 text-sm text-muted-foreground">
        Powers the &ldquo;Read aloud&rdquo; button on chat responses, using your browser&rsquo;s built-in text-to-speech.
      </div>

      {!supported ? (
        <div className="text-sm text-muted-foreground">Not supported in this browser.</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-14 flex-none text-sm text-muted-foreground">Voice</div>
            <Select
              value={settings.voiceURI ?? 'default'}
              onValueChange={(value) => persist({ voiceURI: value === 'default' ? null : (value as string) })}
            >
              <SelectTrigger aria-label="Read-aloud voice" className="w-[260px]">
                <SelectValue>
                  {(value: string) =>
                    value === 'default'
                      ? 'Browser default'
                      : (voices.find((v) => v.voiceURI === value)?.name ?? 'Browser default')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Browser default</SelectItem>
                {voices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={togglePreview}
              aria-label={previewing ? 'Stop preview' : 'Preview voice'}
            >
              {previewing ? <SquareIcon className="size-3.5" /> : <PlayIcon className="size-3.5 translate-x-[1px]" />}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 flex-none text-sm text-muted-foreground">Speed</div>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.rate}
              onChange={(e) => persist({ rate: Number(e.target.value) })}
              className="h-1.5 flex-1 accent-primary"
              aria-label="Read-aloud speed"
            />
            <span className="w-10 flex-none text-right text-xs text-muted-foreground">{settings.rate.toFixed(1)}×</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-14 flex-none text-sm text-muted-foreground">Pitch</div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={settings.pitch}
              onChange={(e) => persist({ pitch: Number(e.target.value) })}
              className="h-1.5 flex-1 accent-primary"
              aria-label="Read-aloud pitch"
            />
            <span className="w-10 flex-none text-right text-xs text-muted-foreground">{settings.pitch.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsView({ theme, onSetTheme, onClose, initialTab }: SettingsViewProps) {
  const [active, setActive] = useState(initialTab ?? 'Appearance');
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.defaultOn])),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="flex h-[92vh] w-[min(960px,92vw)] max-w-none flex-col gap-0 p-0 sm:max-w-none"
      >
        <DialogHeader className="flex h-14 flex-none flex-row items-center justify-center border-b px-4">
          <DialogTitle className="text-sm font-medium">Settings</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-[860px] grid-cols-[170px_1fr] gap-[34px] px-6 pt-[26px] pb-10">
            <div className="flex flex-col gap-0.5 text-sm">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActive(item)}
                  className={`cursor-pointer rounded-md px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground ${
                    active === item ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {active === 'Appearance' && (
              <div>
                <h1 className="m-0 mb-1 text-xl font-medium text-foreground">Appearance</h1>
                <p className="m-0 mb-5 text-sm text-muted-foreground">
                  Dark is the default JARVIS experience. Light mode keeps the same structure and accent.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onSetTheme('dark')}
                    className={`overflow-hidden rounded-xl border bg-card text-left transition-colors ${
                      theme === 'dark' ? 'border-primary ring-1 ring-primary' : ''
                    }`}
                  >
                    <div className="flex h-24 bg-neutral-950">
                      <div className="w-10 border-r border-white/10" />
                      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                        <div className="h-[7px] w-[70%] rounded-sm bg-white/15" />
                        <div className="h-[7px] w-[45%] rounded-sm bg-white/10" />
                        <div className="mt-auto h-3.5 rounded-md bg-white/10" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-foreground">
                      Dark <CheckIcon className={`ml-auto size-4 text-primary ${theme === 'dark' ? '' : 'invisible'}`} />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTheme('light')}
                    className={`overflow-hidden rounded-xl border bg-card text-left transition-colors ${
                      theme === 'light' ? 'border-primary ring-1 ring-primary' : ''
                    }`}
                  >
                    <div className="flex h-24 bg-neutral-100">
                      <div className="w-10 border-r border-black/10 bg-neutral-200" />
                      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                        <div className="h-[7px] w-[70%] rounded-sm bg-black/15" />
                        <div className="h-[7px] w-[45%] rounded-sm bg-black/10" />
                        <div className="mt-auto h-3.5 rounded-md border border-black/10 bg-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-foreground">
                      Light <CheckIcon className={`ml-auto size-4 text-primary ${theme === 'light' ? '' : 'invisible'}`} />
                    </div>
                  </button>
                </div>

                <div className="mt-3.5 flex flex-col">
                  {TOGGLES.map((t) => (
                    <div key={t.key} className="flex items-center gap-3 border-t py-4 first:pt-4 last:border-b">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{t.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{t.desc}</div>
                      </div>
                      <Switch
                        aria-label={`Toggle ${t.title}`}
                        checked={toggles[t.key]}
                        onCheckedChange={(checked) => setToggles((prev) => ({ ...prev, [t.key]: checked }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active === 'Voice' && (
              <div>
                <VoicePanel />
                <ReadAloudPanel />
              </div>
            )}

            {active === 'Account' && <AccountPanel />}

            {active !== 'Appearance' && active !== 'Voice' && active !== 'Account' && (
              <div>
                <h1 className="m-0 mb-1 text-xl font-medium text-foreground">{active}</h1>
                <p className="m-0 text-sm text-muted-foreground">Coming soon.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
