import { Controller, Get } from '@nestjs/common';
import { DatabaseHealthService } from './database/database-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'loongarch-b1-api',
      timestamp: new Date().toISOString(),
      runtime: {
        node: process.version,
        arch: process.arch,
        platform: process.platform,
      },
    };
  }

  @Get('database')
  getDatabaseHealth() {
    return this.databaseHealthService.check();
  }
}
