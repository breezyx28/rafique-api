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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrdersService } from '../orders/orders.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('phone') phone?: string,
  ) {
    return this.customersService.findAll(pagination, search, phone);
  }

  @Get('list')
  async listSimple() {
    return this.customersService.findAllSimple();
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(parseInt(id, 10));
  }

  @Get(':id/measurements')
  async getMeasurements(@Param('id') id: string) {
    const orders = await this.ordersService.findByCustomerWithMeasurements(
      parseInt(id, 10),
    );
    return orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productName: item.product?.name ?? null,
        measurements: item.measurements.map((m) => ({
          id: m.id,
          fieldId: m.fieldId,
          value: m.value,
          field: m.field
            ? {
                id: m.field.id,
                fieldKey: m.field.fieldKey,
                inputType: m.field.inputType,
                required: m.field.required,
                i18n: m.field.i18n,
              }
            : null,
        })),
      })),
    }));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(parseInt(id, 10), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.customersService.remove(parseInt(id, 10));
  }
}
