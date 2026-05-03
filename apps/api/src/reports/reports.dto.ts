import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export const reportTypes = ['student', 'class', 'course'] as const;
export const reportFormats = ['xlsx', 'pdf'] as const;
export const reportExportStatuses = ['queued', 'running', 'succeeded', 'failed'] as const;

export type ReportType = (typeof reportTypes)[number];
export type ReportFormat = (typeof reportFormats)[number];
export type ReportExportStatus = (typeof reportExportStatuses)[number];

export class ReportFilterDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  experimentId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class CreateReportExportDto {
  @IsIn(reportTypes)
  reportType!: ReportType;

  @IsIn(reportFormats)
  format!: ReportFormat;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportFilterDto)
  filters?: ReportFilterDto;
}

export class ListReportExportsQueryDto {
  @IsOptional()
  @IsIn(reportTypes)
  reportType?: ReportType;

  @IsOptional()
  @IsIn(reportExportStatuses)
  status?: ReportExportStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
