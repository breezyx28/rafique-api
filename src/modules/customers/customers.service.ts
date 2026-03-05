import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private repo: Repository<Customer>,
  ) {}

  async create(dto: CreateCustomerDto) {
    const customer = this.repo.create(dto);
    return this.repo.save(customer);
  }

  async findAllSimple() {
    return this.repo.find({
      select: ['id', 'name', 'phone'],
      order: { name: 'ASC', id: 'ASC' },
    });
  }

  async findAll(pagination: PaginationDto, search?: string, phone?: string) {
    const { page = 1, limit = 20 } = pagination;
    const qb = this.repo.createQueryBuilder('c');
    if (search) {
      qb.andWhere('(c.name LIKE :search OR c.phone LIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (phone) {
      qb.andWhere('c.phone = :phone', { phone });
    }
    const [items, total] = await qb
      .orderBy('c.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    if (!items.length) {
      return { data: [], meta: { page, limit, total } };
    }

    const ids = items.map((c) => c.id);
    const aggregates = await this.repo
      .createQueryBuilder('c')
      .leftJoin('c.orders', 'o')
      .select('c.id', 'id')
      .addSelect('COUNT(o.id)', 'ordersCount')
      .addSelect('COALESCE(SUM(o.total), 0)', 'totalSpent')
      .addSelect('MAX(o.created_at)', 'lastOrderDate')
      .where('c.id IN (:...ids)', { ids })
      .groupBy('c.id')
      .getRawMany();

    const map = new Map<
      number,
      { ordersCount: number; totalSpent: number; lastOrderDate: string | null }
    >();
    for (const row of aggregates) {
      const id = Number(row.id);
      const ordersCount = Number(row.ordersCount ?? 0);
      const totalSpent = Number(row.totalSpent ?? 0);
      const lastOrderDate =
        row.lastOrderDate != null ? String(row.lastOrderDate) : null;
      map.set(id, { ordersCount, totalSpent, lastOrderDate });
    }

    const enriched = items.map((c) => {
      const agg = map.get(c.id);
      return {
        ...c,
        ordersCount: agg?.ordersCount ?? 0,
        totalSpent: agg?.totalSpent ?? 0,
        lastOrderDate: agg?.lastOrderDate ?? null,
      };
    });

    return { data: enriched, meta: { page, limit, total } };
  }

  async findByPhone(phone: string) {
    return this.repo.findOne({ where: { phone } });
  }

  async findOne(id: number) {
    const customer = await this.repo.findOne({
      where: { id },
      relations: ['orders'],
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const orders = customer.orders ?? [];
    const ordersCount = orders.length;
    const totalSpent = orders.reduce(
      (sum, o) => sum + Number((o as any).total ?? 0),
      0,
    );
    const lastOrderDate =
      orders.length > 0
        ? orders
            .map((o) => (o as any).createdAt as Date | undefined)
            .filter((d): d is Date => !!d)
            .sort((a, b) => b.getTime() - a.getTime())[0]
            ?.toISOString()
            .slice(0, 10) ?? null
        : null;

    return {
      ...customer,
      ordersCount,
      totalSpent,
      lastOrderDate,
    };
  }

  async update(id: number, dto: UpdateCustomerDto) {
    await this.repo.update(id, dto as Partial<Customer>);
    return this.findOne(id);
  }

  async remove(id: number) {
    const customer = await this.findOne(id);
    await this.repo.remove(customer);
    return { ok: true };
  }
}
