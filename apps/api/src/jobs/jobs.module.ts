import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JobQueueService } from './job-queue.service';

@Module({
  imports: [DatabaseModule],
  providers: [JobQueueService],
  exports: [JobQueueService],
})
export class JobsModule {}
