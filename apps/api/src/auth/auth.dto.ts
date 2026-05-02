import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class BootstrapAdminDto {
  @IsString()
  @MinLength(8)
  bootstrapToken!: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsString()
  @MinLength(8)
  initialPassword!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
