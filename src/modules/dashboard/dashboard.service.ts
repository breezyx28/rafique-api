import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from '../orders/entities/order.entity';
import {
  OrderItem,
  WorkshopItemStatus,
} from '../orders/entities/order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Fabric } from '../inventory/entities/fabric.entity';

const LOW_STOCK = 6;

function dateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, amount: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return dateOnly(date);
}

function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
}

function mondayOf(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDay();
  const offset = (day + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dateOnly(date);
}

type Grain = 'day' | 'week' | 'month';

function asDateOnly(value: string | Date): string {
  if (value instanceof Date) return dateOnly(value);
  const text = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : dateOnly(parsed);
}

function bucketKey(iso: string, grain: Grain): string {
  if (grain === 'day') return iso;
  if (grain === 'week') return mondayOf(iso);
  return iso.slice(0, 7);
}

function bucketsBetween(from: string, to: string, grain: Grain): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = from;
  while (cursor <= to) {
    const key = bucketKey(cursor, grain);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor = addDays(cursor, 1);
  }
  return keys;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private itemRepo: Repository<OrderItem>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    @InjectRepository(InventoryItem)
    private inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(Fabric)
    private fabricRepo: Repository<Fabric>,
  ) {}

  private resolveRange(from?: string, to?: string) {
    const today = dateOnly(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : monthStart;
    const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
    return start <= end ? { from: start, to: end } : { from: end, to: start };
  }

  async getStats() {
    const overview = await this.getOverview();
    return {
      totalOrders: overview.stats.orders,
      totalRevenue: overview.stats.paid,
      activeCustomers: overview.stats.customers,
      workingDays: overview.stats.workingDays,
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
      for (const row of compareMonths)
        compare[row.month] = parseFloat(row.total ?? '0');
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

  async getOverview(from?: string, to?: string) {
    const range = this.resolveRange(from, to);
    const fromStamp = `${range.from} 00:00:00`;
    const toExclusive = `${addDays(range.to, 1)} 00:00:00`;
    const days = diffDays(range.from, range.to) + 1;
    const grain: Grain = days <= 14 ? 'day' : days <= 92 ? 'week' : 'month';

    const [orders, expenses, newCustomers, activeCustomers, fabrics, stockItems, workshopRows] =
      await Promise.all([
        this.orderRepo
          .createQueryBuilder('o')
          .leftJoinAndSelect('o.customer', 'customer')
          .leftJoinAndSelect('o.items', 'items')
          .leftJoinAndSelect('items.product', 'product')
          .where('o.created_at >= :fromStamp', { fromStamp })
          .andWhere('o.created_at < :toExclusive', { toExclusive })
          .orderBy('o.created_at', 'DESC')
          .getMany(),
        this.expenseRepo
          .createQueryBuilder('e')
          .leftJoinAndSelect('e.type', 'type')
          .where('e.date >= :from', { from: range.from })
          .andWhere('e.date <= :to', { to: range.to })
          .getMany(),
        this.customerRepo
          .createQueryBuilder('c')
          .where('c.created_at >= :fromStamp', { fromStamp })
          .andWhere('c.created_at < :toExclusive', { toExclusive })
          .getCount(),
        this.customerRepo
          .createQueryBuilder('c')
          .innerJoin('c.orders', 'o')
          .where('o.created_at >= :fromStamp', { fromStamp })
          .andWhere('o.created_at < :toExclusive', { toExclusive })
          .select('COUNT(DISTINCT c.id)', 'count')
          .getRawOne(),
        this.fabricRepo.find(),
        this.inventoryRepo.find(),
        this.itemRepo
          .createQueryBuilder('i')
          .innerJoin('i.order', 'o')
          .where('o.workshop_delivered_at IS NOT NULL')
          .select('i.workshop_status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('i.workshop_status')
          .getRawMany(),
      ]);

    const live = orders.filter((order) => order.status !== OrderStatus.CANCELLED);
    const paid = live.reduce((sum, order) => sum + Number(order.paid), 0);
    const remaining = live.reduce((sum, order) => sum + Number(order.remaining), 0);
    const revenue = live.reduce((sum, order) => sum + Number(order.total), 0);
    const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.amount), 0);

    const byType = {
      custom: live.filter((order) => order.type === OrderType.CUSTOM).length,
      ready: live.filter((order) => order.type === OrderType.READY).length,
      fabric: live.filter((order) => order.type === OrderType.FABRIC).length,
    };

    const statusCounts: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const order of orders) {
      statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
    }

    const workingDays = new Set(
      live.map((order) => dateOnly(new Date(order.createdAt))),
    ).size;

    const readyStock = stockItems.reduce((sum, item) => sum + Number(item.qty), 0);
    const lowStock = stockItems.filter((item) => Number(item.qty) <= LOW_STOCK).length;
    const fabricMeters = fabrics.reduce((sum, fabric) => sum + Number(fabric.qty), 0);

    const workshopReady = workshopRows
      .filter((row) => row.status === WorkshopItemStatus.READY)
      .reduce((sum, row) => sum + Number(row.count), 0);
    const workshopNotReady = workshopRows
      .filter((row) => row.status !== WorkshopItemStatus.READY)
      .reduce((sum, row) => sum + Number(row.count), 0);

    const productMap = new Map<string, { name: string; qty: number; total: number }>();
    for (const order of live) {
      for (const item of order.items ?? []) {
        const name = item.product?.name ?? 'Item';
        const current = productMap.get(name) ?? { name, qty: 0, total: 0 };
        current.qty += Number(item.qty);
        current.total += Number(item.subtotal);
        productMap.set(name, current);
      }
    }

    const customerMap = new Map<
      number,
      { customerId: number; name: string; phone: string | null; ordersCount: number; totalSpent: number }
    >();
    for (const order of live) {
      if (!order.customer) continue;
      const current = customerMap.get(order.customer.id) ?? {
        customerId: order.customer.id,
        name: order.customer.name,
        phone: order.customer.phone,
        ordersCount: 0,
        totalSpent: 0,
      };
      current.ordersCount += 1;
      current.totalSpent += Number(order.total);
      customerMap.set(order.customer.id, current);
    }

    const expenseByType = new Map<string, number>();
    for (const row of expenses) {
      const name = row.type?.name ?? 'Other';
      expenseByType.set(name, (expenseByType.get(name) ?? 0) + Number(row.amount));
    }

    const keys = bucketsBetween(range.from, range.to, grain);
    const timelineMap = new Map(
      keys.map((key) => [key, { date: key, orders: 0, revenue: 0, expenses: 0 }]),
    );
    for (const order of live) {
      const key = bucketKey(dateOnly(new Date(order.createdAt)), grain);
      const bucket = timelineMap.get(key);
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.revenue += Number(order.paid);
    }
    for (const row of expenses) {
      const key = bucketKey(asDateOnly(row.date), grain);
      const bucket = timelineMap.get(key);
      if (!bucket) continue;
      bucket.expenses += Number(row.amount);
    }

    return {
      period: { from: range.from, to: range.to, grain },
      stats: {
        orders: live.length,
        customOrders: byType.custom,
        readyOrders: byType.ready,
        fabricOrders: byType.fabric,
        revenue,
        paid,
        remaining,
        expenses: expenseTotal,
        customers: parseInt(activeCustomers?.count ?? '0', 10),
        newCustomers,
        workingDays,
        readyStock,
        lowStock,
        fabricMeters,
        workshopReady,
        workshopNotReady,
      },
      timeline: keys.map((key) => timelineMap.get(key)!),
      ordersByStatus: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      })),
      ordersByType: [
        { type: 'custom', count: byType.custom },
        { type: 'ready', count: byType.ready },
        { type: 'fabric', count: byType.fabric },
      ],
      workshopByStatus: [
        { status: 'ready', count: workshopReady },
        { status: 'not_ready', count: workshopNotReady },
      ],
      expensesByType: [...expenseByType.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
      topProducts: [...productMap.values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, 6),
      topCustomers: [...customerMap.values()]
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5),
      recentOrders: orders.slice(0, 8).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer?.name ?? 'Walk-in',
        type: order.type,
        status: order.status,
        total: Number(order.total),
        createdAt:
          order.createdAt instanceof Date
            ? order.createdAt.toISOString()
            : String(order.createdAt),
      })),
      fabrics: fabrics.map((fabric) => ({
        id: fabric.id,
        name: fabric.name,
        meters: Number(fabric.qty),
        packageMeters: Number(fabric.packageMeters) || 20,
      })),
    };
  }
}
