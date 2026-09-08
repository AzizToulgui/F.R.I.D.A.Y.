'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileTextIcon, UploadIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
            <h1 className="m-0 text-[26px] font-normal text-foreground">Knowledge</h1>
            <p className="mt-2 max-w-[50ch] text-sm leading-[1.65] text-muted-foreground">
              Documents FRIDAY can retrieve from during conversations. Answers cite the document (and section) they
              came from.
            </p>
          </div>
          <Button type="button" size="lg" onClick={() => fileInputRef.current?.click()}>
            <UploadIcon /> Upload documents
          </Button>
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
          className={`my-[22px] mb-5 rounded-2xl border border-dashed bg-primary/5 p-[26px] text-center transition-colors ${
            dragActive ? 'border-primary' : 'border-primary/40'
          }`}
        >
          <div className="text-[13.5px] text-primary">Drop files here to index</div>
          <div className="mt-[5px] font-mono text-[11.5px] text-muted-foreground">PDF · DOCX · MD · TXT</div>
        </div>

        {error && <div className="mb-3 text-[13px] text-destructive">{error}</div>}

        <div className="mb-2.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          DOCUMENTS · {docs.length}
        </div>
        {loading ? (
          <div className="text-[13.5px] text-muted-foreground">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground">Nothing uploaded yet - drop a file above to get started.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {docs.map((d) => (
              <Card
                key={d.id}
                size="sm"
                className={`p-[15px_17px] ${
                  d.status === 'error' ? 'bg-destructive/5 ring-destructive/30' : d.status === 'indexing' ? 'bg-primary/5 ring-primary/30' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileTextIcon className={`size-4 ${d.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-foreground">{d.title}</div>
                    {d.status === 'error' ? (
                      <div className="mt-[3px] text-[11.5px] text-destructive">
                        {d.errorMessage ?? "Couldn't process this file."}
                      </div>
                    ) : (
                      <div
                        className={`mt-[3px] font-mono text-[11.5px] ${
                          d.status === 'indexing' ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {formatSize(d.sizeBytes)} · {d.format.toUpperCase()}
                        {d.status === 'indexed' ? ` · ${d.chunkCount} CHUNKS` : ' · INDEXING…'}
                      </div>
                    )}
                  </div>
                  {d.status === 'indexed' && (
                    <Badge variant="outline" className="flex-none border-ok/30 font-mono text-[10.5px] text-ok">
                      INDEXED
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" className="flex-none" onClick={() => void remove(d.id)}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
