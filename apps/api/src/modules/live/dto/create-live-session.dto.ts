import { IsBoolean, IsOptional } from 'class-validator';

// Per-call Tunisian Savage Mode flag from a dedicated launch button (see
// apps/web TopBar.tsx's Savage Mode button) - not a saved preference, so
// this never touches UsersService or the User entity; LiveController reads
// it straight off the request body.
export class CreateLiveSessionDto {
  @IsOptional()
  @IsBoolean()
  savageMode?: boolean;
}
