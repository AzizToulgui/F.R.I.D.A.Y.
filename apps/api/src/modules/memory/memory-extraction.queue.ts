export const MEMORY_EXTRACTION_QUEUE = 'memory-extraction';

export interface MemoryExtractionJob {
  userId: string;
  conversationId: string;
}
