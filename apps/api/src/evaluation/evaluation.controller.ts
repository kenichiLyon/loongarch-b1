import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../domain/core';
import { EvaluationService } from './evaluation.service';

@Controller('evaluations')
@UseGuards(AuthGuard, RolesGuard)
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get('submissions/:submissionId')
  getSubmissionEvaluation(
    @Param('submissionId', new ParseUUIDPipe()) submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.evaluationService.getEvaluationForUser(submissionId, user);
  }
}
