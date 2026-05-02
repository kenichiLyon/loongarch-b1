import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FoundationModule } from './foundation/foundation.module';
import { HealthController } from './health.controller';
import { SubmissionsModule } from './submissions/submissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    DatabaseModule,
    FoundationModule,
    SubmissionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
