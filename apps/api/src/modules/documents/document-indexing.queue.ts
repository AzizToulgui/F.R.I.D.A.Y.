import { DocumentFormat } from './entities/document.entity';

export const DOCUMENT_INDEXING_QUEUE = 'document-indexing';

export interface DocumentIndexingJob {
  documentId: string;
  userId: string;
  // Path to the uploaded bytes on local disk (see DocumentsService.createFromUpload) -
  // the raw file is never stored permanently, only long enough for this job to parse it.
  filePath: string;
  format: DocumentFormat;
}
