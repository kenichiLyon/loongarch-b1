import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
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
