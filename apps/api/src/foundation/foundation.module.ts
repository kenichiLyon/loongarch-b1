import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FoundationController } from './foundation.controller';
import { FoundationService } from './foundation.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [FoundationController],
  providers: [FoundationService],
})
export class FoundationModule {}
