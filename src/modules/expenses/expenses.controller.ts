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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpenseTypeDto } from './dto/create-expense-type.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('types')
  async getTypes() {
    return this.expensesService.getTypes();
  }

  @Post('types')
  async createType(@Body() dto: CreateExpenseTypeDto) {
    return this.expensesService.createType(dto);
  }

  @Get()
  async findAll(@Query() query: ExpensesQueryDto) {
    const { page, limit, from, to, type } = query;
    return this.expensesService.findAll(
      { page, limit },
      from,
      to,
      type,
    );
  }

  @Get('summary')
  async summary(@Query('period') period: 'today' | 'month' | 'year' = 'today') {
    return this.expensesService.getSummary(period);
  }

  @Post()
  async create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(parseInt(id, 10));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateExpenseDto>) {
    return this.expensesService.update(parseInt(id, 10), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.expensesService.remove(parseInt(id, 10));
  }
}
