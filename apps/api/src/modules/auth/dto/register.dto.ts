import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Length only - complexity rules are a UX/entropy trade-off best enforced
  // client-side; the server floor just blocks trivially weak passwords.
  @IsString()
  @Length(8, 128)
  password!: string;

  @IsString()
  @Length(1, 120)
  displayName!: string;
}
