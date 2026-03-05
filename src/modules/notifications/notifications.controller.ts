import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 20;
    return this.notificationsService.findAll(l);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notificationsService.markRead(parseInt(id, 10));
    return { ok: true };
  }

  @Patch('mark-all-read')
  async markAllRead() {
    await this.notificationsService.markAllRead();
    return { ok: true };
  }
}

