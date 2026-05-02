import { Global, Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService, DatabaseHealthService],
  exports: [DatabaseService, DatabaseHealthService],
})
export class DatabaseModule {}
