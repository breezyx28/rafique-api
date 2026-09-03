import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import { CreateReadyOrderDto } from './dto/create-ready-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { CreateFabricOrderDto } from './dto/create-fabric-order.dto';
import { UpdateCustomOrderDto } from './dto/update-order-item-fabric.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Cashier')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('custom')
  async createCustom(@Body() dto: CreateCustomOrderDto) {
    return this.ordersService.createCustom(dto);
  }

  @Post('ready')
  async createReady(@Body() dto: CreateReadyOrderDto) {
    return this.ordersService.createReady(dto);
  }

  @Post('fabric')
  async createFabric(@Body() dto: CreateFabricOrderDto) {
    return this.ordersService.createFabricOrder(dto);
  }

  @Get()
  async findAll(@Query() query: OrdersQueryDto) {
    const { page, limit, type, status, from, to } = query;
    return this.ordersService.findAll({ page, limit }, { type, status, from, to });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(parseInt(id, 10));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateCustomOrderDto,
  ) {
    return this.ordersService.update(parseInt(id, 10), body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(parseInt(id, 10));
  }
}
