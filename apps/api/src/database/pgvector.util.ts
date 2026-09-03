// pgvector's text input/output format for a vector column is a bracketed,
// comma-separated literal - not JSON, and not something the pg driver
// serializes for us automatically since vector columns carry no TypeORM
// type (see Memory/DocumentChunk entities - every read/write of an
// `embedding` column goes through raw SQL using this literal).
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
