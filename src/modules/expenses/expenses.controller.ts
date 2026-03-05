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
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
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
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') typeId?: string,
  ) {
    return this.expensesService.findAll(
      pagination,
      from,
      to,
      typeId ? parseInt(typeId, 10) : undefined,
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
