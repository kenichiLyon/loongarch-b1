import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
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
}
