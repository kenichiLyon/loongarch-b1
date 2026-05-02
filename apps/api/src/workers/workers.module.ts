import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { StorageModule } from '../storage/storage.module';
import { ParseWorkerService } from './parse-worker.service';

@Module({
  imports: [DatabaseModule, JobsModule, StorageModule],
  providers: [ParseWorkerService],
  exports: [ParseWorkerService],
})
export class WorkersModule {}
