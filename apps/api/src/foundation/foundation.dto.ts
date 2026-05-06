import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ArtifactKind, UserRole } from '../domain/core';

export class CreateUserDto {
  @IsEnum(UserRole)
  role!: UserRole;

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

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  studentNo?: string;

  @IsOptional()
  @IsString()
  teacherNo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  major?: string;
}

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  ownerTeacherId?: string;
}

export class AttachCourseClassDto {
  @IsUUID()
  classId!: string;
}

export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  courseId!: string;

  @IsUUID()
  classId!: string;
}

export class ListEnrollmentsQueryDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class CreateRubricMetricDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  description = '';

  @IsNumber()
  @Min(0.001)
  @Max(100)
  weight!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @IsString()
  scoringRule?: string;

  @IsOptional()
  @IsBoolean()
  allowTeacherOverride?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateRubricDto {
  @IsUUID()
  courseId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRubricMetricDto)
  metrics!: CreateRubricMetricDto[];
}

export class CreateExperimentDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  rubricTemplateId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  requirementText!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ArtifactKind, { each: true })
  allowedArtifactKinds?: ArtifactKind[];

  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
