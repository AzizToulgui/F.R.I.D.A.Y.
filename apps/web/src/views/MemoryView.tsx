'use client';

interface MemoryItem {
  text: string;
  meta: string;
  fresh?: boolean;
}

const MEMORIES: MemoryItem[] = [
  { text: 'Prefers TypeScript with strict mode; dislikes default exports.', meta: 'ADDED 2 DAYS AGO · FROM "PROJECT ARCHITECTURE"' },
  { text: 'Building a realtime voice assistant; latency budget is 300 ms end-to-end.', meta: 'ADDED TODAY · FROM VOICE SESSION' },
  { text: 'Works from Bengaluru; schedule meetings after 10:00 IST.', meta: 'JUST REMEMBERED', fresh: true },
  { text: 'Replies in English; occasionally switches to Hindi mid-sentence.', meta: 'ADDED LAST WEEK' },
];

export function MemoryView() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-6 pt-[38px] pb-[60px]">
        <h1 className="m-0 text-[26px] font-normal text-tx">Memory</h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-[1.65] text-tx3">
          JARVIS keeps a small set of facts so future conversations start informed. Everything here is editable, and
          nothing is stored without appearing on this page.
        </p>
        <div className="my-[22px] mb-[18px] flex flex-wrap gap-2.5">
          <input
            aria-label="Search memories"
            placeholder="Search memories…"
            className="h-[38px] min-w-[220px] flex-1 rounded-[10px] border border-line2 bg-panel px-[13px] text-[13.5px] text-tx outline-none focus:border-ac-m"
          />
          <button
            type="button"
            className="h-[38px] cursor-pointer rounded-[10px] border border-line2 bg-transparent px-3.5 text-[13px] text-tx2 hover:border-line3 hover:text-tx"
          >
            Memory settings
          </button>
          <button
            type="button"
            className="h-[38px] cursor-pointer rounded-[10px] border border-danger-line bg-transparent px-3.5 text-[13px] text-danger hover:bg-danger-bg"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {MEMORIES.map((m) => (
            <div
              key={m.text}
              className={`flex items-start gap-3.5 rounded-[13px] border p-[15px_17px] hover:border-ac-m ${
                m.fresh ? 'border-ac-m bg-ac-xs' : 'border-line bg-panel'
              }`}
            >
              <div className="flex-1">
                <div className="text-[14px] leading-[1.55] text-tx">{m.text}</div>
                <div className={`mt-1.5 font-mono text-[11px] ${m.fresh ? 'text-ac-tx' : 'text-tx4'}`}>{m.meta}</div>
              </div>
              <div className="flex flex-none gap-3 text-[12.5px] text-tx3">
                <span className="cursor-pointer">Edit</span>
                <span className="cursor-pointer text-[#c98d8d]">Delete</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
