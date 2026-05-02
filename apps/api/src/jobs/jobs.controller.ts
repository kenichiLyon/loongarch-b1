import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../domain/core';
import { JobQueueService } from './job-queue.service';
import { ListJobsQueryDto } from './jobs.dto';

@Controller('jobs')
@UseGuards(AuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobQueueService: JobQueueService) {}

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get()
  listJobs(@Query() query: ListJobsQueryDto) {
    return this.jobQueueService.listJobs(query);
  }

  @Roles(UserRole.Admin, UserRole.Teacher)
  @Get(':jobId')
  getJob(@Param('jobId', new ParseUUIDPipe()) jobId: string) {
    return this.jobQueueService.getJob(jobId);
  }
}
