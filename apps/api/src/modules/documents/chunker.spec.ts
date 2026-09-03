import { chunkText } from './chunker';

describe('chunkText', () => {
  it('returns a single chunk for text under the target size', () => {
    const chunks = chunkText('Just a short paragraph.', 650, 0.12);
    expect(chunks).toEqual([{ content: 'Just a short paragraph.', headingPath: null }]);
  });

  it('returns nothing for empty/whitespace-only input', () => {
    expect(chunkText('', 650, 0.12)).toEqual([]);
    expect(chunkText('   \n\n   ', 650, 0.12)).toEqual([]);
  });

  it('splits long text into multiple chunks, each within roughly the target size', () => {
    const targetTokens = 50; // 200 chars
    const paragraph = 'word '.repeat(30).trim(); // ~150 chars
    const text = Array.from({ length: 6 }, (_, i) => `${paragraph} (${i})`).join('\n\n');

    const chunks = chunkText(text, targetTokens, 0.12);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(targetTokens * 4 + 40); // generous slack for the overlap carry-over
      expect(chunk.content.length).toBeGreaterThan(0);
    }
    // The whole document's content should still be recoverable across chunks (nothing silently dropped).
    for (let i = 0; i < 6; i++) {
      expect(chunks.some((c) => c.content.includes(`(${i})`))).toBe(true);
    }
  });

  it('carries the tail of one chunk into the start of the next as overlap', () => {
    const targetTokens = 50; // 200 chars
    const paragraph = 'alpha beta gamma delta epsilon zeta eta theta iota kappa'; // ~58 chars
    const text = Array.from({ length: 6 }, () => paragraph).join('\n\n'); // ~360 chars, well over the target

    const chunks = chunkText(text, targetTokens, 0.2);
    expect(chunks.length).toBeGreaterThan(1);

    const overlapChars = Math.round(targetTokens * 4 * 0.2);
    const tailOfFirst = chunks[0].content.slice(-overlapChars).trim();
    expect(tailOfFirst.length).toBeGreaterThan(0);
    expect(chunks[1].content.startsWith(tailOfFirst.split(' ')[0])).toBe(true);
  });

  it('tracks the most recent markdown heading as headingPath', () => {
    const text = ['# Introduction', 'Some intro text.', '## Setup', 'Some setup text.'].join('\n\n');
    const chunks = chunkText(text, 650, 0.12);

    expect(chunks.some((c) => c.headingPath === 'Introduction')).toBe(true);
    expect(chunks.some((c) => c.headingPath === 'Setup')).toBe(true);
  });

  it('hard-splits a single paragraph much larger than the target size', () => {
    const targetTokens = 20; // 80 chars
    const hugeParagraph = 'word '.repeat(100).trim(); // ~500 chars, no paragraph breaks at all

    const chunks = chunkText(hugeParagraph, targetTokens, 0.1);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(targetTokens * 4 + 20);
    }
  });
});
