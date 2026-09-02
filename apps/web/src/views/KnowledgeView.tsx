'use client';

type DocStatus = 'indexed' | 'indexing' | 'error';

interface DocItem {
  name: string;
  meta: string;
  status: DocStatus;
  progress?: number;
  error?: string;
}

const DOCS: DocItem[] = [
  { name: 'Project architecture.pdf', meta: '24 MB · 182 CHUNKS · READY', status: 'indexed' },
  { name: 'Latency benchmarks Q3.csv', meta: 'INDEXING · 64 / 96 CHUNKS', status: 'indexing', progress: 66 },
  { name: 'voice-pipeline.md', meta: '86 KB · 41 CHUNKS · READY', status: 'indexed' },
  { name: 'Board deck v9.pptx', meta: '', status: 'error', error: "Couldn't read this file — it looks password protected." },
];

export function KnowledgeView() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[860px] px-6 pt-[38px] pb-[60px]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px] flex-1">
            <h1 className="m-0 text-[26px] font-normal text-tx">Knowledge</h1>
            <p className="mt-2 max-w-[50ch] text-sm leading-[1.65] text-tx3">
              Documents JARVIS can retrieve from during conversations. Answers cite the exact page they came from.
            </p>
          </div>
          <button
            type="button"
            className="h-10 cursor-pointer rounded-[11px] border-0 bg-ac px-[18px] text-[13.5px] font-semibold text-ac-fg hover:bg-ac-hi"
          >
            Upload documents
          </button>
        </div>

        <div className="my-[22px] mb-5 rounded-2xl border border-dashed border-ac-m bg-ac-xs p-[26px] text-center">
          <div className="text-[13.5px] text-ac-tx">Drop files here to index</div>
          <div className="mt-[5px] font-mono text-[11.5px] text-tx4">PDF · DOCX · MD · TXT · CSV · UP TO 100 MB</div>
        </div>

        <div className="mb-2.5 font-mono text-[10px] tracking-[0.14em] text-tx4">DOCUMENTS · {DOCS.length}</div>
        <div className="flex flex-col gap-2.5">
          {DOCS.map((d) => (
            <div
              key={d.name}
              className={`rounded-[13px] border p-[15px_17px] ${
                d.status === 'error'
                  ? 'border-danger-line bg-danger-bg'
                  : d.status === 'indexing'
                    ? 'border-ac-m bg-ac-xs'
                    : 'border-line bg-panel'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={d.status === 'error' ? 'text-[#e0a0a0]' : 'text-tx3'}>▤</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-tx">{d.name}</div>
                  {d.status === 'error' ? (
                    <div className="mt-[3px] text-[11.5px] text-[#f0b3b3]">{d.error}</div>
                  ) : (
                    <div
                      className={`mt-[3px] font-mono text-[11.5px] ${
                        d.status === 'indexing' ? 'text-ac-tx' : 'text-tx4'
                      }`}
                    >
                      {d.meta}
                    </div>
                  )}
                  {d.status === 'indexing' && (
                    <div className="mt-[9px] h-[3px] overflow-hidden rounded-sm bg-line">
                      <div className="h-full bg-ac shadow-[0_0_10px_var(--ac)]" style={{ width: `${d.progress}%` }} />
                    </div>
                  )}
                </div>
                {d.status === 'indexed' && (
                  <span className="flex-none rounded-full border border-[rgba(120,220,160,0.28)] px-2.5 py-[3px] font-mono text-[10.5px] text-ok">
                    INDEXED
                  </span>
                )}
                {d.status === 'error' && (
                  <button
                    type="button"
                    className="flex-none cursor-pointer rounded-[9px] border border-danger-line bg-transparent px-3 py-1.5 text-xs text-danger hover:bg-danger-bg"
                  >
                    Try again
                  </button>
                )}
                <span className="flex-none cursor-pointer text-tx4">•••</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
