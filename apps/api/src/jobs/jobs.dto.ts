import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { JobStatus, JobType } from './job-queue.service';

export const jobTypes: JobType[] = ['parse_artifact', 'evaluate_submission', 'export_report'];
export const jobStatuses: JobStatus[] = ['queued', 'running', 'succeeded', 'failed', 'cancelled'];

export class ListJobsQueryDto {
  @IsOptional()
  @IsIn(jobTypes)
  jobType?: JobType;

  @IsOptional()
  @IsIn(jobStatuses)
  status?: JobStatus;

  @IsOptional()
  @IsUUID()
  submissionId?: string;

  @IsOptional()
  @IsUUID()
  artifactId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
