import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ArtifactKind } from '../domain/core';

export class CreateSubmissionDto {
  @IsUUID()
  experimentId!: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attemptNo?: number;
}

export class UploadArtifactDto {
  @IsEnum(ArtifactKind)
  kind!: ArtifactKind;
}
