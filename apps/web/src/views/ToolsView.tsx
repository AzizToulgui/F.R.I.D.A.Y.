'use client';

import { useState } from 'react';

interface ToolItem {
  key: string;
  icon: string;
  name: string;
  desc: string;
  available: boolean;
  defaultOn: boolean;
}

const TOOLS: ToolItem[] = [
  { key: 'calendar', icon: '◷', name: 'Calendar', desc: 'Read events, create and move meetings. Asks before writing.', available: true, defaultOn: true },
  { key: 'reminders', icon: '◔', name: 'Reminders', desc: 'Create and complete reminders from conversation.', available: true, defaultOn: true },
  { key: 'web', icon: '⌕', name: 'Web search', desc: 'Fetch current information with citations.', available: true, defaultOn: true },
  { key: 'notes', icon: '◍', name: 'Notes', desc: 'Append to and search your notes.', available: false, defaultOn: false },
  { key: 'email', icon: '✉', name: 'Email', desc: 'Draft and send messages on your behalf.', available: false, defaultOn: false },
];

export function ToolsView() {
  const [on, setOn] = useState<Record<string, boolean>>(
    Object.fromEntries(TOOLS.map((t) => [t.key, t.defaultOn])),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[860px] px-6 pt-[38px] pb-[60px]">
        <h1 className="m-0 text-[26px] font-normal text-tx">Tools</h1>
        <p className="mt-2 mb-[22px] max-w-[52ch] text-sm leading-[1.65] text-tx3">
          Capabilities JARVIS can use on your behalf. Anything that changes your data asks first.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2.5">
          {TOOLS.map((t) => (
            <div
              key={t.key}
              className={`rounded-[13px] border p-4 ${
                t.available ? 'border-line bg-panel' : 'border-line bg-bg2 opacity-70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-tx3">{t.icon}</span>
                <div className="flex-1 text-[14px] text-tx">{t.name}</div>
                <button
                  type="button"
                  disabled={!t.available}
                  onClick={() => setOn((prev) => ({ ...prev, [t.key]: !prev[t.key] }))}
                  aria-pressed={on[t.key]}
                  aria-label={`Toggle ${t.name}`}
                  className={`jv-toggle ${on[t.key] ? 'is-on' : ''}`}
                />
              </div>
              <div className="mt-2 text-[12.5px] leading-[1.55] text-tx3">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
