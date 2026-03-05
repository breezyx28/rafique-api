import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  async getStats() {
    const [totalOrders, revenueResult, activeCustomers, workingDays] = await Promise.all([
      this.orderRepo.count(),
      this.orderRepo.createQueryBuilder('o').select('SUM(o.total)', 'sum').getRawOne(),
      this.customerRepo.createQueryBuilder('c').innerJoin('c.orders', 'o').select('COUNT(DISTINCT c.id)', 'count').getRawOne(),
      Promise.resolve(22), // placeholder: working days logic can be from settings
    ]);
    const totalRevenue = parseFloat(revenueResult?.sum ?? '0');
    const activeCount = parseInt(activeCustomers?.count ?? '0', 10);
    return {
      totalOrders,
      totalRevenue,
      activeCustomers: activeCount,
      workingDays,
    };
  }

  async getSalesChart(year: number, compareYear?: number) {
    const months = await this.orderRepo
      .createQueryBuilder('o')
      .select('MONTH(o.created_at)', 'month')
      .addSelect('SUM(o.total)', 'total')
      .where('YEAR(o.created_at) = :year', { year })
      .groupBy('month')
      .getRawMany();
    const byMonth: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = 0;
    for (const row of months) byMonth[row.month] = parseFloat(row.total ?? '0');

    let compare: Record<number, number> | undefined;
    if (compareYear) {
      const compareMonths = await this.orderRepo
        .createQueryBuilder('o')
        .select('MONTH(o.created_at)', 'month')
        .addSelect('SUM(o.total)', 'total')
        .where('YEAR(o.created_at) = :year', { year: compareYear })
        .groupBy('month')
        .getRawMany();
      compare = {};
      for (let m = 1; m <= 12; m++) compare[m] = 0;
      for (const row of compareMonths) compare[row.month] = parseFloat(row.total ?? '0');
    }

    return {
      year,
      compareYear: compareYear ?? null,
      data: Object.entries(byMonth).map(([m, total]) => ({
        month: parseInt(m, 10),
        total,
        compare: compare?.[parseInt(m, 10)] ?? null,
      })),
    };
  }

  async getTopProducts(limit = 10) {
    const result = await this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('o.items', 'i')
      .innerJoin('i.product', 'p')
      .select('p.id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('SUM(i.qty)', 'qty')
      .addSelect('SUM(i.subtotal)', 'total')
      .groupBy('p.id')
      .addGroupBy('p.name')
      .orderBy('SUM(i.subtotal)', 'DESC')
      .limit(limit)
      .getRawMany();
    return result.map((r) => ({
      productId: r.productId,
      name: r.name,
      qty: parseInt(r.qty ?? '0', 10),
      total: parseFloat(r.total ?? '0'),
    }));
  }

  async getTopCustomers(limit = 20) {
    const result = await this.customerRepo
      .createQueryBuilder('c')
      .leftJoin('c.orders', 'o')
      .select('c.id', 'customerId')
      .addSelect('c.name', 'name')
      .addSelect('c.phone', 'phone')
      .addSelect('COUNT(o.id)', 'ordersCount')
      .addSelect('COALESCE(SUM(o.total), 0)', 'totalSpent')
      .groupBy('c.id')
      .addGroupBy('c.name')
      .addGroupBy('c.phone')
      .orderBy('totalSpent', 'DESC')
      .limit(limit)
      .getRawMany();
    return result.map((r) => ({
      customerId: r.customerId,
      name: r.name,
      phone: r.phone,
      ordersCount: parseInt(r.ordersCount ?? '0', 10),
      totalSpent: parseFloat(r.totalSpent ?? '0'),
    }));
  }
}
