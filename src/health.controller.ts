import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'rafique-api',
      version: '0.1.1',
      endpoints: [
        'dashboard/overview',
        'notifications/unread-count',
        'orders',
        'users',
        'workshop/orders',
        'workshop/payroll',
      ],
    };
  }
}
