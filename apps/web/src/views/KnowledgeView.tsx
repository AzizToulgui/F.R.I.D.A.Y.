'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

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
const ACCEPTED_EXTENSIONS = '.pdf,.docx,.md,.markdown,.txt';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeView() {
  const { authFetch } = useAuth();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Keeps status/chunkCount fresh while the background indexing job runs -
  // stops polling once nothing is left in the 'indexing' state.
  useEffect(() => {
    if (!docs.some((d) => d.status === 'indexing')) return;
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [docs, load]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const created = await authFetch<DocItem>('/documents', { method: 'POST', body: formData });
          setDocs((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
        } catch (e) {
          setError(e instanceof Error ? e.message : `Could not upload "${file.name}".`);
        }
      }
    },
    [authFetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = docs;
      setDocs((prev) => prev.filter((d) => d.id !== id));
      try {
        await authFetch(`/documents/${id}`, { method: 'DELETE' });
      } catch (e) {
        setDocs(previous);
        setError(e instanceof Error ? e.message : 'Could not delete that document.');
      }
    },
    [authFetch, docs],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[860px] px-6 pt-[38px] pb-[60px]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px] flex-1">
            <h1 className="m-0 text-[26px] font-normal text-tx">Knowledge</h1>
            <p className="mt-2 max-w-[50ch] text-sm leading-[1.65] text-tx3">
              Documents JARVIS can retrieve from during conversations. Answers cite the document (and section) they
              came from.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 cursor-pointer rounded-[11px] border-0 bg-ac px-[18px] text-[13.5px] font-semibold text-ac-fg hover:bg-ac-hi"
          >
            Upload documents
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
          }}
          className={`my-[22px] mb-5 rounded-2xl border border-dashed p-[26px] text-center transition-colors ${
            dragActive ? 'border-ac bg-ac-xs' : 'border-ac-m bg-ac-xs'
          }`}
        >
          <div className="text-[13.5px] text-ac-tx">Drop files here to index</div>
          <div className="mt-[5px] font-mono text-[11.5px] text-tx4">PDF · DOCX · MD · TXT</div>
        </div>

        {error && <div className="mb-3 text-[13px] text-danger">{error}</div>}

        <div className="mb-2.5 font-mono text-[10px] tracking-[0.14em] text-tx4">DOCUMENTS · {docs.length}</div>
        {loading ? (
          <div className="text-[13.5px] text-tx3">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-[13.5px] text-tx3">Nothing uploaded yet - drop a file above to get started.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {docs.map((d) => (
              <div
                key={d.id}
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
                    <div className="text-[14px] text-tx">{d.title}</div>
                    {d.status === 'error' ? (
                      <div className="mt-[3px] text-[11.5px] text-[#f0b3b3]">
                        {d.errorMessage ?? "Couldn't process this file."}
                      </div>
                    ) : (
                      <div
                        className={`mt-[3px] font-mono text-[11.5px] ${
                          d.status === 'indexing' ? 'text-ac-tx' : 'text-tx4'
                        }`}
                      >
                        {formatSize(d.sizeBytes)} · {d.format.toUpperCase()}
                        {d.status === 'indexed' ? ` · ${d.chunkCount} CHUNKS` : ' · INDEXING…'}
                      </div>
                    )}
                  </div>
                  {d.status === 'indexed' && (
                    <span className="flex-none rounded-full border border-[rgba(120,220,160,0.28)] px-2.5 py-[3px] font-mono text-[10.5px] text-ok">
                      INDEXED
                    </span>
                  )}
                  <span className="flex-none cursor-pointer text-tx4" onClick={() => void remove(d.id)}>
                    Remove
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
