import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { JobQueueService } from './job-queue.service';
import { JobsController } from './jobs.controller';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [JobsController],
  providers: [JobQueueService],
  exports: [JobQueueService],
})
export class JobsModule {}
