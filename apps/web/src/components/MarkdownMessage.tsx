'use client';

import { useState } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Gemini's real replies use markdown (JARVIS_TEXT_SYSTEM_PROMPT explicitly
// allows "plain prose and light markdown") - this renders it properly
// instead of showing raw asterisks/backticks/pipes as literal text.
// Deliberately no syntax-highlighting tokenizer (e.g. shiki/prismjs) - that's
// real added weight/complexity for a cosmetic gain; plain monospace with a
// language label and a working copy button covers the actual defect (raw
// markdown syntax leaking into the UI) without it.

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false);
  const codeElement = children as { props?: { className?: string; children?: ReactNode } } | undefined;
  const language = /language-(\w+)/.exec(codeElement?.props?.className ?? '')?.[1] ?? 'text';
  const rawText = extractText(codeElement?.props?.children);

  const copy = () => {
    void navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-line bg-bg2">
      <div className="flex items-center border-b border-line px-3 py-2 font-mono text-[10.5px] tracking-[0.1em] text-tx4">
        {language.toUpperCase()}
        <button type="button" onClick={copy} className="ml-auto cursor-pointer text-tx3 hover:text-tx">
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-3.5 font-mono text-[12.5px] leading-[1.75] text-tx2" {...props}>
        {children}
      </pre>
    </div>
  );
}

// react-markdown (v9+) no longer passes an `inline` flag to `code` - a
// fenced block's `code` node carries a `language-*` className (from the
// fence info string) and an inline span never does, which is the documented
// way to tell them apart now.
function InlineCode({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  if (className?.includes('language-')) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
  return (
    <code className="rounded bg-line px-1.5 py-0.5 text-[0.9em] text-ac-tx" {...props}>
      {children}
    </code>
  );
}

const components: Components = {
  p: ({ children }) => <p className="text-[15px] leading-[1.72] text-tx2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-[15px] leading-[1.8] text-tx2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-[1.8] text-tx2">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-ac-tx underline hover:text-ac">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-tx">{children}</strong>,
  h1: ({ children }) => <h3 className="text-[18px] font-medium text-tx">{children}</h3>,
  h2: ({ children }) => <h3 className="text-[16.5px] font-medium text-tx">{children}</h3>,
  h3: ({ children }) => <h3 className="text-[15.5px] font-medium text-tx">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-line2 pl-3 text-tx3 italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-line" />,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[13.5px] text-tx2">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line px-2.5 py-1.5 text-left text-tx">{children}</th>,
  td: ({ children }) => <td className="border border-line px-2.5 py-1.5">{children}</td>,
  pre: CodeBlock,
  code: InlineCode,
};

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
