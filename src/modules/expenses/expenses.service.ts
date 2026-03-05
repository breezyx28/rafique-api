import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { ExpenseType } from './entities/expense-type.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpenseTypeDto } from './dto/create-expense-type.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    @InjectRepository(ExpenseType)
    private typeRepo: Repository<ExpenseType>,
  ) {}

  async getTypes() {
    return this.typeRepo.find({ order: { name: 'ASC' } });
  }

  async createType(dto: CreateExpenseTypeDto) {
    const type = this.typeRepo.create({ ...dto, isCustom: dto.isCustom ?? true });
    return this.typeRepo.save(type);
  }

  async findAll(
    pagination: PaginationDto,
    from?: string,
    to?: string,
    typeId?: number,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.type', 'type');
    if (from) qb.andWhere('e.date >= :from', { from });
    if (to) qb.andWhere('e.date <= :to', { to });
    if (typeId) qb.andWhere('e.typeId = :typeId', { typeId });
    const [items, total] = await qb
      .orderBy('e.date', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: items, meta: { page, limit, total } };
  }

  async create(dto: CreateExpenseDto) {
    const expense = this.expenseRepo.create(dto);
    return this.expenseRepo.save(expense);
  }

  async findOne(id: number) {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: ['type'],
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(id: number, dto: Partial<CreateExpenseDto>) {
    await this.expenseRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const expense = await this.findOne(id);
    await this.expenseRepo.remove(expense);
    return { ok: true };
  }

  async getSummary(period: 'today' | 'month' | 'year') {
    const qb = this.expenseRepo.createQueryBuilder('e').select('SUM(e.amount)', 'total');
    const now = new Date();
    if (period === 'today') {
      qb.andWhere('e.date = :date', { date: now.toISOString().slice(0, 10) });
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      qb.andWhere('e.date >= :start', { start });
    } else {
      const start = `${now.getFullYear()}-01-01`;
      qb.andWhere('e.date >= :start', { start });
    }
    const { total } = await qb.getRawOne();
    return { total: total ?? 0 };
  }
}
