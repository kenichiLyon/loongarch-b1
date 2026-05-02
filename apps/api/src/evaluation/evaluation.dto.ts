import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class ReviewMetricScoreDto {
  @IsUUID()
  rubricMetricId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  teacherScore!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ReviewSubmissionDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewMetricScoreDto)
  metricScores?: ReviewMetricScoreDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  teacherComment?: string;
}
