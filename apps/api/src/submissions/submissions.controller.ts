import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diskStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../domain/core';
import { sanitizeFileName } from '../storage/local-object-store.service';
import { readUploadMaxBytes } from './artifact-upload.policy';
import { CreateSubmissionDto, UploadArtifactDto } from './submissions.dto';
import { SubmissionsService } from './submissions.service';

const multerUploadLimit = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
const uploadTempRoot = path.join(os.tmpdir(), 'loongarch-b1-uploads');
mkdirSync(uploadTempRoot, { recursive: true });

@Controller('submissions')
@UseGuards(AuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Get()
  listSubmissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('experimentId') experimentId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.submissionsService.listSubmissions({ experimentId, studentId }, user);
  }

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Post()
  createSubmission(@Body() dto: CreateSubmissionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.submissionsService.createSubmission(dto, user);
  }

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Post(':submissionId/artifacts/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadTempRoot,
        filename: (_request, file, callback) => {
          callback(null, `${Date.now()}-${randomUUID()}-${sanitizeFileName(file.originalname)}`);
        },
      }),
      limits: { fileSize: multerUploadLimit || readUploadMaxBytes() },
    }),
  )
  uploadArtifact(
    @Param('submissionId') submissionId: string,
    @Body() dto: UploadArtifactDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionsService.uploadArtifact(submissionId, dto, file, user);
  }
}
