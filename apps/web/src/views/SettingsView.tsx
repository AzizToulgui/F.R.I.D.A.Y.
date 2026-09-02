'use client';

import { useState } from 'react';
import type { Theme } from '@/types';

interface SettingsViewProps {
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
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

export function SettingsView({ theme, onSetTheme }: SettingsViewProps) {
  const [active, setActive] = useState('Appearance');
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.key, t.defaultOn])),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-[860px] grid-cols-[170px_1fr] gap-[34px] px-6 pt-[38px] pb-[60px]">
        <div className="flex flex-col gap-0.5 text-[13.5px]">
          {NAV_ITEMS.map((item) => (
            <div
              key={item}
              onClick={() => setActive(item)}
              className={`cursor-pointer rounded-[9px] px-[11px] py-2 text-tx3 hover:text-tx ${
                active === item ? 'bg-ac-xs text-tx shadow-[inset_1px_0_0_var(--ac)]' : ''
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        <div>
          <h1 className="m-0 mb-1 text-[22px] font-normal text-tx">Appearance</h1>
          <p className="m-0 mb-5 text-[13.5px] text-tx3">
            Dark is the default JARVIS experience. Light mode keeps the same structure and accent.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => onSetTheme('dark')}
              className={`cursor-pointer overflow-hidden rounded-[13px] border bg-panel ${
                theme === 'dark' ? 'border-ac-l' : 'border-line2'
              }`}
            >
              <div className="flex h-24 [background:radial-gradient(200px_90px_at_50%_0%,rgba(95,216,255,0.12),transparent),#07090b]">
                <div className="w-10 border-r border-[rgba(255,255,255,0.06)]" />
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <div className="h-[7px] w-[70%] rounded-sm bg-[rgba(255,255,255,0.14)]" />
                  <div className="h-[7px] w-[45%] rounded-sm bg-[rgba(255,255,255,0.09)]" />
                  <div className="mt-auto h-3.5 rounded-md bg-[rgba(255,255,255,0.06)]" />
                </div>
              </div>
              <div className="flex items-center gap-2 px-[13px] py-[11px] text-[13px] text-tx">
                Dark <span className={`ml-auto text-ac ${theme === 'dark' ? '' : 'invisible'}`}>✓</span>
              </div>
            </div>
            <div
              onClick={() => onSetTheme('light')}
              className={`cursor-pointer overflow-hidden rounded-[13px] border bg-panel ${
                theme === 'light' ? 'border-ac-l' : 'border-line2'
              }`}
            >
              <div className="flex h-24 bg-[#f4f6f8]">
                <div className="w-10 border-r border-[rgba(0,0,0,0.07)] bg-[#eceff2]" />
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <div className="h-[7px] w-[70%] rounded-sm bg-[rgba(20,30,40,0.22)]" />
                  <div className="h-[7px] w-[45%] rounded-sm bg-[rgba(20,30,40,0.13)]" />
                  <div className="mt-auto h-3.5 rounded-md border border-[rgba(20,30,40,0.12)] bg-white" />
                </div>
              </div>
              <div className="flex items-center gap-2 px-[13px] py-[11px] text-[13px] text-tx">
                Light <span className={`ml-auto text-ac ${theme === 'light' ? '' : 'invisible'}`}>✓</span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex flex-col">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center gap-3 border-t border-line py-[15px] first:pt-[15px] last:border-b">
                <div className="flex-1">
                  <div className="text-[14px] text-tx">{t.title}</div>
                  <div className="mt-[3px] text-[12.5px] text-tx3">{t.desc}</div>
                </div>
                <button
                  type="button"
                  aria-pressed={toggles[t.key]}
                  aria-label={`Toggle ${t.title}`}
                  onClick={() => setToggles((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                  className={`jv-toggle ${toggles[t.key] ? 'is-on' : ''}`}
                />
              </div>
            ))}
            <div className="flex items-center gap-3 border-t border-b border-line py-[15px]">
              <div className="flex-1">
                <div className="text-[14px] text-tx">Voice</div>
                <div className="mt-[3px] text-[12.5px] text-tx3">Calm, measured, British-leaning delivery.</div>
              </div>
              <button
                type="button"
                className="h-8 cursor-pointer rounded-[9px] border border-line2 bg-transparent px-3 text-[12.5px] text-tx2 hover:border-line3"
              >
                Aurum ▾
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
