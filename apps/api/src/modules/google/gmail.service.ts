import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAccountService } from './google-account.service';

export interface UnreadEmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string | null;
}

@Injectable()
export class GmailService {
  constructor(private readonly googleAccountService: GoogleAccountService) {}

  async listUnread(userId: string, maxResults: number): Promise<UnreadEmailSummary[]> {
    const auth = await this.googleAccountService.getAuthorizedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const { data: list } = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults,
    });
    const messageIds = list.messages ?? [];
    if (messageIds.length === 0) return [];

    // Metadata only (From/Subject/Date headers) - never the message body, so
    // an unread-email check never pulls full email content through the model.
    const summaries = await Promise.all(
      messageIds.map(async (m): Promise<UnreadEmailSummary> => {
        const { data: message } = await gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = message.payload?.headers ?? [];
        const header = (name: string) => headers.find((h) => h.name === name)?.value ?? '';
        const parsedDate = new Date(header('Date'));
        return {
          id: message.id!,
          from: header('From'),
          subject: header('Subject'),
          snippet: message.snippet ?? '',
          receivedAt: Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString(),
        };
      }),
    );
    return summaries;
  }
}
