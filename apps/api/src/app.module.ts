import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FoundationModule } from './foundation/foundation.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    AuditModule,
    DatabaseModule,
    FoundationModule,
    JobsModule,
    SubmissionsModule,
    WorkersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
