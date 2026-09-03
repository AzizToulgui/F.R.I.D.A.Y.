// Recursive, token-aware chunking (ARCHITECTURE.md Section 11: "~500-800
// tokens, ~10-15% overlap") that preserves section/heading metadata for
// citations. Deliberately local/synchronous - calling AIProvider.countTokens
// per candidate chunk boundary would mean one Gemini call per paragraph just
// to decide where to cut, which is exactly the kind of cost Section 18 rules
// out. Character count / 4 is the same rough token estimate
// ConversationEngineService.safeCountTokens falls back to.
const CHARS_PER_TOKEN = 4;
// Purely to keep the hard-split loop below from spinning forever on a
// degenerate config value (e.g. RAG_CHUNK_TARGET_TOKENS=0) - not a realistic
// production size (defaults sit at 650 tokens / ~2600 chars).
const MIN_CHUNK_CHARS = 40;

export interface TextChunk {
  content: string;
  headingPath: string | null;
}

/** Recognizes a markdown ATX heading line ("# Title", "## Title", ...). */
function headingText(paragraph: string): string | null {
  const match = paragraph.match(/^#{1,6}\s+(.+)/);
  return match ? match[1].trim() : null;
}

export function chunkText(text: string, targetTokens: number, overlapRatio: number): TextChunk[] {
  const targetChars = Math.max(targetTokens * CHARS_PER_TOKEN, MIN_CHUNK_CHARS);
  const overlapChars = Math.round(targetChars * overlapRatio);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let current = '';
  let currentHeading: string | null = null;

  const flush = () => {
    if (current.trim()) chunks.push({ content: current.trim(), headingPath: currentHeading });
  };

  // A paragraph longer than the target on its own can't just be appended -
  // hard-split it (and whatever was already pending in `current`) on word
  // boundaries, carrying the configured overlap forward between pieces.
  const hardSplitCurrent = (): void => {
    let rest = current;
    while (rest.length > targetChars) {
      let cut = rest.lastIndexOf(' ', targetChars);
      if (cut <= 0) cut = targetChars;
      chunks.push({ content: rest.slice(0, cut).trim(), headingPath: currentHeading });
      rest = rest.slice(Math.max(cut - overlapChars, 0));
    }
    current = rest;
  };

  for (const paragraph of paragraphs) {
    const heading = headingText(paragraph);

    // A new heading always starts a fresh chunk (no overlap carried across
    // it) - otherwise a chunk's headingPath could point at a heading whose
    // section content it doesn't actually contain, which is exactly what
    // this metadata exists to prevent.
    if (heading && heading !== currentHeading && current.length > 0) {
      flush();
      current = '';
    }
    if (heading) currentHeading = heading;

    const wouldOverflow = current.length > 0 && current.length + paragraph.length + 2 > targetChars;
    if (wouldOverflow) {
      flush();
      current = current.slice(-overlapChars).trim();
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;
    if (current.length > targetChars) hardSplitCurrent();
  }
  flush();

  return chunks.filter((chunk) => chunk.content.length > 0);
}
