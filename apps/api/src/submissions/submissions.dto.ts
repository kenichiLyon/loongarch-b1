import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min, MinLength } from 'class-validator';
import { ArtifactKind, SubmissionStatus } from '../domain/core';

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

export class CreateGitLinkArtifactDto {
  @IsString()
  @MinLength(10)
  @Matches(/^https?:\/\/.+/i, { message: 'Git link must be an http or https URL' })
  url!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  branch?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{7,40}$/i, { message: 'commitSha must be 7-40 hex characters' })
  commitSha?: string;
}

export class ListSubmissionsQueryDto {
  @IsOptional()
  @IsUUID()
  experimentId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}
