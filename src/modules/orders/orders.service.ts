import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Order,
  OrderType,
  OrderStatus,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderMeasurement } from './entities/order-measurement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import { CreateReadyOrderDto } from './dto/create-ready-order.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderMeasurement)
    private measurementRepo: Repository<OrderMeasurement>,
    @InjectRepository(InventoryItem)
    private inventoryRepo: Repository<InventoryItem>,
    private notificationsService: NotificationsService,
  ) {}

  private async nextOrderNumber(): Promise<string> {
    const last = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.orderNumber')
      .orderBy('o.id', 'DESC')
      .limit(1)
      .getOne();
    const num = last ? parseInt(last.orderNumber, 10) + 1 : 1;
    return num.toString().padStart(5, '0');
  }

  async createCustom(dto: CreateCustomOrderDto) {
    const orderNumber = await this.nextOrderNumber();
    const remaining = Number(dto.total) - Number(dto.paid);
    const order = this.orderRepo.create({
      orderNumber,
      customerId: dto.customerId,
      type: OrderType.CUSTOM,
      status: OrderStatus.PENDING,
      total: dto.total,
      paid: dto.paid,
      remaining,
      paymentMethod: dto.paymentMethod ?? null,
      dueDate: dto.dueDate ?? null,
      noteCustomer: dto.noteCustomer ?? null,
      noteWorkshop: dto.noteWorkshop ?? null,
    });
    const saved = await this.orderRepo.save(order);
    for (const it of dto.items) {
      const subtotal = Number(it.unitPrice) * it.qty;
      const item = this.itemRepo.create({
        orderId: saved.id,
        productId: it.productId,
        qty: it.qty,
        unitPrice: it.unitPrice,
        subtotal,
      });
      const savedItem = await this.itemRepo.save(item);
      for (const m of it.measurements) {
        const meas = this.measurementRepo.create({
          orderItemId: savedItem.id,
          fieldId: m.fieldId,
          value: m.value,
        });
        await this.measurementRepo.save(meas);
      }
    }
    return this.findOne(saved.id);
  }

  async createReady(dto: CreateReadyOrderDto) {
    const orderNumber = await this.nextOrderNumber();
    const remaining = Number(dto.total) - Number(dto.paid);
    const order = this.orderRepo.create({
      orderNumber,
      customerId: null,
      type: OrderType.READY,
      status: OrderStatus.PENDING,
      total: dto.total,
      paid: dto.paid,
      remaining,
      paymentMethod: dto.paymentMethod ?? null,
      dueDate: dto.dueDate ?? null,
    });
    const saved = await this.orderRepo.save(order);
    for (const it of dto.items) {
      const inv = await this.inventoryRepo.findOne({ where: { id: it.inventoryItemId } });
      if (!inv) throw new NotFoundException(`Inventory item ${it.inventoryItemId} not found`);
      const subtotal = Number(it.unitPrice) * it.qty;
      await this.itemRepo.save(
        this.itemRepo.create({
          orderId: saved.id,
          productId: inv.productId,
          qty: it.qty,
          unitPrice: it.unitPrice,
          subtotal,
        }),
      );
      inv.qty = Math.max(0, Number(inv.qty) - it.qty);
      await this.inventoryRepo.save(inv);
      await this.notificationsService.createStockNotificationIfNeeded(inv.id);
    }
    return this.findOne(saved.id);
  }

  async findAll(
    pagination: PaginationDto,
    filters?: { type?: OrderType; status?: OrderStatus; from?: string; to?: string },
  ) {
    const { page = 1, limit = 20 } = pagination;
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'product');
    if (filters?.type) qb.andWhere('o.type = :type', { type: filters.type });
    if (filters?.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters?.from) qb.andWhere('o.created_at >= :from', { from: filters.from });
    if (filters?.to) qb.andWhere('o.created_at <= :to', { to: filters.to });
    const [items, total] = await qb
      .orderBy('o.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data: items, meta: { page, limit, total } };
  }

  async findOne(id: number) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product', 'items.measurements', 'items.measurements.field', 'items.measurements.field.i18n'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

   async findByCustomerWithMeasurements(customerId: number) {
    const orders = await this.orderRepo.find({
      where: { customer: { id: customerId } },
      relations: [
        'customer',
        'items',
        'items.product',
        'items.measurements',
        'items.measurements.field',
        'items.measurements.field.i18n',
      ],
      order: { id: 'DESC' },
    });
    return orders;
  }

  async update(id: number, updates: Partial<Order>) {
    await this.orderRepo.update(id, updates);
    return this.findOne(id);
  }

  async remove(id: number) {
    const order = await this.findOne(id);
    await this.orderRepo.remove(order);
    return { ok: true };
  }
}
