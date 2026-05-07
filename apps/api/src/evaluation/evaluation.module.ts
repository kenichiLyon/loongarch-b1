import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { LlmModule } from '../llm/llm.module';
import { EvaluationContextBuilderService } from './evaluation-context-builder.service';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationWorkerService } from './evaluation-worker.service';

@Module({
  imports: [AuditModule, AuthModule, DatabaseModule, JobsModule, LlmModule],
  controllers: [EvaluationController],
  providers: [EvaluationContextBuilderService, EvaluationService, EvaluationWorkerService],
  exports: [EvaluationContextBuilderService, EvaluationService, EvaluationWorkerService],
})
export class EvaluationModule {}
