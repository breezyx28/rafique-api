import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SetReadinessDto } from './dto/set-readiness.dto';
import { WorkshopService } from './workshop.service';

@Controller('workshop')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Workshop')
export class WorkshopController {
  constructor(private readonly workshopService: WorkshopService) {}

  @Get('orders')
  listDelivered() {
    return this.workshopService.listDelivered();
  }

  @Patch('orders/:id/deliver')
  @Roles('Admin', 'Cashier')
  deliver(@Param('id') id: string) {
    return this.workshopService.deliver(Number(id));
  }

  @Patch('orders/:id/undo-deliver')
  @Roles('Admin', 'Cashier')
  undoDeliver(@Param('id') id: string) {
    return this.workshopService.undoDeliver(Number(id));
  }

  @Patch('items/:id/readiness')
  setReadiness(@Param('id') id: string, @Body() dto: SetReadinessDto) {
    return this.workshopService.setItemReadiness(Number(id), dto.ready);
  }

  @Get('payroll')
  @Roles('Admin')
  payroll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productId') productId?: string,
  ) {
    const parsedProductId = productId ? Number(productId) : undefined;
    return this.workshopService.getPayroll({
      from: from || undefined,
      to: to || undefined,
      productId:
        parsedProductId != null && Number.isFinite(parsedProductId)
          ? parsedProductId
          : undefined,
    });
  }

  @Get('productivity')
  @Roles('Admin')
  productivity() {
    return this.workshopService.productivity();
  }
}
