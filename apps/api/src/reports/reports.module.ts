import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';
import { ReportsController } from './reports.controller';
import { ReportExportWorkerService } from './report-export-worker.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuditModule, DatabaseModule, JobsModule, StorageModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExportWorkerService],
  exports: [ReportsService, ReportExportWorkerService],
})
export class ReportsModule {}
