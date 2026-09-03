import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { DocumentFormat } from './entities/document.entity';

const PDF_MIME_TYPES = new Set(['application/pdf']);
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Format is inferred from the file extension first, falling back to the browser-supplied MIME type. */
export function detectFormat(filename: string, mimetype: string): DocumentFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || PDF_MIME_TYPES.has(mimetype)) return DocumentFormat.PDF;
  if (ext === 'docx' || DOCX_MIME_TYPES.has(mimetype)) return DocumentFormat.DOCX;
  if (ext === 'md' || ext === 'markdown') return DocumentFormat.MARKDOWN;
  if (ext === 'txt') return DocumentFormat.TEXT;
  return null;
}

export async function parseDocumentText(buffer: Buffer, format: DocumentFormat): Promise<string> {
  switch (format) {
    case DocumentFormat.PDF: {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
    case DocumentFormat.DOCX: {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case DocumentFormat.MARKDOWN:
    case DocumentFormat.TEXT:
      return buffer.toString('utf-8');
  }
}
