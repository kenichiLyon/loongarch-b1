import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../domain/core';
import { ReviewSubmissionDto } from './evaluation.dto';
import { EvaluationService } from './evaluation.service';

@Controller('evaluations')
@UseGuards(AuthGuard, RolesGuard)
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('submissions/:submissionId')
  getSubmissionEvaluation(@Param('submissionId', new ParseUUIDPipe()) submissionId: string): Promise<unknown> {
    return this.evaluationService.getEvaluation(submissionId);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('submissions/:submissionId/context-latest')
  getLatestSubmissionContext(@Param('submissionId', new ParseUUIDPipe()) submissionId: string): Promise<unknown> {
    return this.evaluationService.getLatestContextSnapshot(submissionId);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('submissions/:submissionId/context-history')
  getSubmissionContextHistory(@Param('submissionId', new ParseUUIDPipe()) submissionId: string): Promise<unknown> {
    return this.evaluationService.getContextSnapshotHistory(submissionId);
  }

  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Student)
  @Get('submissions/:submissionId/published')
  getPublishedSubmissionEvaluation(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.evaluationService.getPublishedEvaluation(submissionId, user);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Patch('submissions/:submissionId/review')
  reviewSubmissionEvaluation(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @Body() dto: ReviewSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.evaluationService.reviewSubmission(submissionId, dto, user);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Post('submissions/:submissionId/publish')
  publishSubmissionEvaluation(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.evaluationService.publishEvaluation(submissionId, user);
  }
}
