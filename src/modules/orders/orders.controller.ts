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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderType, OrderStatus } from './entities/order.entity';

@Controller('orders')
@UseGuards(JwtAuthGuard)
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

  @Get()
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('type') type?: OrderType,
    @Query('status') status?: OrderStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAll(pagination, { type, status, from, to });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(parseInt(id, 10));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { status?: OrderStatus; paid?: number },
  ) {
    return this.ordersService.update(parseInt(id, 10), body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(parseInt(id, 10));
  }
}
