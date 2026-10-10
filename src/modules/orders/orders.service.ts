import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, MoreThan, Not, Repository } from 'typeorm';
import {
  Order,
  OrderType,
  OrderStatus,
  PaymentMethod,
} from './entities/order.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { Customer } from '../customers/entities/customer.entity';

function calendarDay(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}
import { OrderItem } from './entities/order-item.entity';
import { OrderMeasurement } from './entities/order-measurement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { CreateCustomOrderDto } from './dto/create-custom-order.dto';
import { CreateReadyOrderDto } from './dto/create-ready-order.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderItemFabricConsumption } from './entities/order-item-fabric-consumption.entity';
import { OrderFabricSale } from './entities/order-fabric-sale.entity';
import { Fabric } from '../inventory/entities/fabric.entity';
import {
  FabricMovementType,
  FabricStockMovement,
} from '../inventory/entities/fabric-stock-movement.entity';
import { CreateFabricOrderDto } from './dto/create-fabric-order.dto';
import { UpdateCustomOrderDto } from './dto/update-order-item-fabric.dto';

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
    @InjectRepository(OrderItemFabricConsumption)
    private fabricConsumptionRepo: Repository<OrderItemFabricConsumption>,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
  ) {}

  private async nextOrderNumber(
    repo: Repository<Order> = this.orderRepo,
  ): Promise<string> {
    const last = await repo
      .createQueryBuilder('o')
      .select('o.orderNumber')
      .orderBy('o.id', 'DESC')
      .limit(1)
      .getOne();
    const num = last ? parseInt(last.orderNumber, 10) + 1 : 1;
    return num.toString().padStart(5, '0');
  }

  private async recordReceipt(
    manager: EntityManager,
    orderId: number,
    amount: number,
    method: PaymentMethod | null | undefined,
    paidAt = new Date(),
  ) {
    const value = Number(amount);
    if (!(value > 0)) return;
    const repo = manager.getRepository(OrderPayment);
    await repo.save(
      repo.create({
        orderId,
        amount: value,
        paymentMethod: method ?? PaymentMethod.CASH,
        paidAt,
      }),
    );
  }

  async createCustom(dto: CreateCustomOrderDto) {
    if (!dto.items.length) {
      throw new BadRequestException('At least one custom product is required');
    }
    const total = dto.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.qty,
      0,
    );
    if (dto.paid < 0 || dto.paid > total) {
      throw new BadRequestException('Paid amount must be between zero and total');
    }

    const savedId = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const measurementRepo = manager.getRepository(OrderMeasurement);
      const consumptionRepo = manager.getRepository(
        OrderItemFabricConsumption,
      );
      const fabricRepo = manager.getRepository(Fabric);

      for (const requested of dto.items) {
        const fabric = await fabricRepo.findOneBy({ id: requested.fabricId });
        if (!fabric) {
          throw new NotFoundException(`Fabric ${requested.fabricId} not found`);
        }
      }

      const order = await orderRepo.save(
        orderRepo.create({
          orderNumber: await this.nextOrderNumber(orderRepo),
          customerId: dto.customerId,
          type: OrderType.CUSTOM,
          status: OrderStatus.PENDING,
          total,
          paid: dto.paid,
          remaining: total - Number(dto.paid),
          paymentMethod: dto.paymentMethod ?? null,
          dueDate: dto.dueDate ?? null,
          noteCustomer: dto.noteCustomer ?? null,
          noteWorkshop: dto.noteWorkshop ?? null,
        }),
      );
      await this.recordReceipt(
        manager,
        order.id,
        dto.paid,
        dto.paymentMethod ?? null,
      );

      for (const requested of dto.items) {
        const item = await itemRepo.save(
          itemRepo.create({
            orderId: order.id,
            productId: requested.productId,
            qty: requested.qty,
            unitPrice: requested.unitPrice,
            subtotal: Number(requested.unitPrice) * requested.qty,
          }),
        );
        await consumptionRepo.save(
          consumptionRepo.create({
            orderItemId: item.id,
            fabricId: requested.fabricId,
            meters: requested.fabricMeters,
            deductedAt: null,
          }),
        );
        for (const measurement of requested.measurements) {
          await measurementRepo.save(
            measurementRepo.create({
              orderItemId: item.id,
              fieldId: measurement.fieldId,
              value: measurement.value,
            }),
          );
        }
      }
      return order.id;
    });
    await this.notificationsService.generateDueNotificationsForDate(new Date());
    return this.findOne(savedId);
  }

  async createReady(dto: CreateReadyOrderDto) {
    if (!dto.items.length) {
      throw new BadRequestException('At least one ready product is required');
    }

    const savedId = await this.dataSource.transaction(async (manager) => {
      const inventoryRepo = manager.getRepository(InventoryItem);
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const resolved: Array<{
        inventory: InventoryItem;
        qty: number;
        unitPrice: number;
      }> = [];

      for (const requested of dto.items) {
        const inventory = await inventoryRepo.findOne({
          where: { id: requested.inventoryItemId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!inventory) {
          throw new NotFoundException(
            `Inventory item ${requested.inventoryItemId} not found`,
          );
        }
        if (Number(inventory.qty) < requested.qty) {
          throw new BadRequestException(
            `Insufficient stock for inventory item ${inventory.id}`,
          );
        }
        resolved.push({
          inventory,
          qty: requested.qty,
          unitPrice: Number(inventory.price),
        });
      }

      const total = resolved.reduce(
        (sum, row) => sum + row.qty * row.unitPrice,
        0,
      );
      if (dto.paid < 0 || dto.paid > total) {
        throw new BadRequestException('Paid amount must be between zero and total');
      }
      if (total - dto.paid > 0.009 && !dto.customerId) {
        throw new BadRequestException('A registered customer is required');
      }
      if (dto.customerId) {
        const customer = await manager.getRepository(Customer).findOneBy({
          id: dto.customerId,
        });
        if (!customer) throw new NotFoundException('Customer not found');
      }

      const orderNumber = await this.nextOrderNumber(orderRepo);
      const order = orderRepo.create({
        orderNumber,
        receiptNumber: `REC-${orderNumber}`,
        customerId: dto.customerId ?? null,
        type: OrderType.READY,
        status: OrderStatus.DELIVERED,
        total,
        paid: dto.paid,
        remaining: total - dto.paid,
        paymentMethod: dto.paymentMethod ?? null,
        dueDate: dto.dueDate ?? null,
      });
      const saved = await orderRepo.save(order);
      await this.recordReceipt(
        manager,
        saved.id,
        dto.paid,
        dto.paymentMethod ?? null,
      );

      for (const row of resolved) {
        await itemRepo.save(
          itemRepo.create({
            orderId: saved.id,
            productId: row.inventory.productId,
            inventoryItemId: row.inventory.id,
            qty: row.qty,
            unitPrice: row.unitPrice,
            subtotal: row.qty * row.unitPrice,
          }),
        );
        row.inventory.qty = Number(row.inventory.qty) - row.qty;
        await inventoryRepo.save(row.inventory);
      }
      return saved.id;
    });

    for (const requested of dto.items) {
      await this.notificationsService.createStockNotificationIfNeeded(
        requested.inventoryItemId,
      );
    }
    await this.notificationsService.generateDueNotificationsForDate(new Date());
    return this.findOne(savedId);
  }

  async createFabricOrder(dto: CreateFabricOrderDto) {
    if (!dto.customerId) {
      throw new BadRequestException('A registered customer is required');
    }
    if (!dto.items.length) {
      throw new BadRequestException('At least one fabric is required');
    }

    const savedId = await this.dataSource.transaction(async (manager) => {
      const fabricRepo = manager.getRepository(Fabric);
      const orderRepo = manager.getRepository(Order);
      const saleRepo = manager.getRepository(OrderFabricSale);
      const movementRepo = manager.getRepository(FabricStockMovement);
      const rows: Array<{ fabric: Fabric; meters: number; unitPrice: number }> = [];

      for (const requested of dto.items) {
        const fabric = await fabricRepo.findOne({
          where: { id: requested.fabricId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!fabric) {
          throw new NotFoundException(`Fabric ${requested.fabricId} not found`);
        }
        if (Number(fabric.qty) < requested.meters) {
          throw new BadRequestException(`Insufficient meters for ${fabric.name}`);
        }
        rows.push({
          fabric,
          meters: requested.meters,
          unitPrice:
            requested.unitPrice != null
              ? Number(requested.unitPrice)
              : Number(fabric.sellingPricePerMeter),
        });
      }

      const total = rows.reduce(
        (sum, row) => sum + row.meters * row.unitPrice,
        0,
      );
      if (dto.paid < 0 || dto.paid > total) {
        throw new BadRequestException('Paid amount must be between zero and total');
      }

      const orderNumber = await this.nextOrderNumber(orderRepo);
      const order = await orderRepo.save(
        orderRepo.create({
          orderNumber,
          receiptNumber: `REC-${orderNumber}`,
          customerId: dto.customerId,
          type: OrderType.FABRIC,
          status: OrderStatus.DELIVERED,
          total,
          paid: dto.paid,
          remaining: total - dto.paid,
          paymentMethod: dto.paymentMethod ?? null,
          dueDate: dto.dueDate ?? null,
          noteCustomer: dto.noteCustomer ?? null,
        }),
      );
      await this.recordReceipt(
        manager,
        order.id,
        dto.paid,
        dto.paymentMethod ?? null,
      );

      for (const row of rows) {
        await saleRepo.save(
          saleRepo.create({
            orderId: order.id,
            fabricId: row.fabric.id,
            meters: row.meters,
            unitPrice: row.unitPrice,
            subtotal: row.meters * row.unitPrice,
          }),
        );
        row.fabric.qty = Number(row.fabric.qty) - row.meters;
        await fabricRepo.save(row.fabric);
        await movementRepo.save(
          movementRepo.create({
            fabricId: row.fabric.id,
            type: FabricMovementType.DIRECT_SALE,
            meters: -row.meters,
            orderId: order.id,
            orderItemId: null,
            note: 'Direct fabric sale',
          }),
        );
      }
      return order.id;
    });

    await this.notificationsService.generateDueNotificationsForDate(new Date());
    return this.findOne(savedId);
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
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.measurements', 'measurements')
      .leftJoinAndSelect('items.fabricConsumptions', 'fabricConsumptions')
      .leftJoinAndSelect('fabricConsumptions.fabric', 'consumptionFabric')
      .leftJoinAndSelect('o.fabricSales', 'fabricSales')
      .leftJoinAndSelect('fabricSales.fabric', 'saleFabric');
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
      relations: [
        'customer',
        'items',
        'items.product',
        'items.measurements',
        'items.measurements.field',
        'items.measurements.field.i18n',
        'items.fabricConsumptions',
        'items.fabricConsumptions.fabric',
        'fabricSales',
        'fabricSales.fabric',
      ],
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

  async update(id: number, dto: UpdateCustomOrderDto) {
    const order = await this.findOne(id);
    const { items, ...updates } = dto;

    if (updates.status === OrderStatus.DELIVERED) {
      if (order.type === OrderType.CUSTOM && order.status !== OrderStatus.READY) {
        throw new BadRequestException(
          'Customer can collect the order only after it is ready for pickup',
        );
      }
    }

    if (items?.length) {
      if (order.workshopDeliveredAt) {
        throw new BadRequestException(
          'Fabric and meters can be changed only before workshop delivery',
        );
      }
      for (const row of items) {
        const item = order.items.find((entry) => entry.id === row.itemId);
        if (!item) {
          throw new NotFoundException(`Order item ${row.itemId} not found`);
        }
        const fabric = await this.dataSource.getRepository(Fabric).findOneBy({
          id: row.fabricId,
        });
        if (!fabric) {
          throw new NotFoundException(`Fabric ${row.fabricId} not found`);
        }
        const existing = item.fabricConsumptions?.[0];
        if (existing) {
          existing.fabricId = row.fabricId;
          existing.meters = row.fabricMeters;
          existing.deductedAt = null;
          await this.fabricConsumptionRepo.save(existing);
        } else {
          await this.fabricConsumptionRepo.save(
            this.fabricConsumptionRepo.create({
              orderItemId: item.id,
              fabricId: row.fabricId,
              meters: row.fabricMeters,
              deductedAt: null,
            }),
          );
        }
      }
    }

    delete updates.remaining;
    if (updates.paid != null) {
      const nextPaid = Number(updates.paid);
      const currentPaid = Number(order.paid);
      const total = Number(order.total);
      if (nextPaid < 0 || nextPaid > total) {
        throw new BadRequestException('Paid amount must be between zero and total');
      }
      if (currentPaid - nextPaid > 0.009) {
        throw new BadRequestException('Paid amount cannot be reduced');
      }
      const increase = nextPaid - currentPaid;
      const nextRemaining = total - nextPaid;
      if (increase > 0.009 && nextRemaining > 0.009 && !order.customerId) {
        throw new BadRequestException('A registered customer is required');
      }
      if (increase > 0.009) {
        await this.dataSource.transaction(async (manager) => {
          await this.recordReceipt(
            manager,
            order.id,
            increase,
            updates.paymentMethod ?? order.paymentMethod,
          );
        });
      }
      updates.paid = nextPaid;
      updates.remaining = nextRemaining;
    }
    if (Object.keys(updates).length) {
      await this.orderRepo.update(id, updates);
    }
    await this.notificationsService.generateDueNotificationsForDate(new Date());
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const inventoryRepo = manager.getRepository(InventoryItem);
      const fabricRepo = manager.getRepository(Fabric);
      const movementRepo = manager.getRepository(FabricStockMovement);
      const locked = await orderRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');
      const order = await orderRepo.findOne({
        where: { id },
        relations: [
          'items',
          'items.fabricConsumptions',
          'fabricSales',
        ],
      });
      if (!order) throw new NotFoundException('Order not found');

      if (order.type === OrderType.READY) {
        for (const item of order.items) {
          if (!item.inventoryItemId) continue;
          const inventory = await inventoryRepo.findOne({
            where: { id: item.inventoryItemId },
            lock: { mode: 'pessimistic_write' },
          });
          if (inventory) {
            inventory.qty = Number(inventory.qty) + item.qty;
            await inventoryRepo.save(inventory);
          }
        }
      }

      const fabricRestores = [
        ...order.fabricSales.map((row) => ({
          fabricId: row.fabricId,
          meters: Number(row.meters),
          itemId: null as number | null,
        })),
        ...order.items.flatMap((item) =>
          item.fabricConsumptions
            .filter((row) => !!row.deductedAt)
            .map((row) => ({
              fabricId: row.fabricId,
              meters: Number(row.meters),
              itemId: item.id,
            })),
        ),
      ];
      for (const restore of fabricRestores) {
        const fabric = await fabricRepo.findOne({
          where: { id: restore.fabricId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!fabric) continue;
        fabric.qty = Number(fabric.qty) + restore.meters;
        await fabricRepo.save(fabric);
        await movementRepo.save(
          movementRepo.create({
            fabricId: fabric.id,
            type: FabricMovementType.REVERSAL,
            meters: restore.meters,
            orderId: order.id,
            orderItemId: restore.itemId,
            note: 'Order deletion stock reversal',
          }),
        );
      }
      await orderRepo.remove(order);
    });
    return { ok: true };
  }

  async receivables(query: {
    from?: string;
    to?: string;
    status?: 'open' | 'settled' | 'all';
  }) {
    const status = query.status ?? 'open';
    const openOrders = await this.orderRepo.find({
      where: {
        remaining: MoreThan(0),
        status: Not(OrderStatus.CANCELLED),
      },
      relations: ['customer'],
    });
    const today = calendarDay(new Date()) ?? '';
    let notYetDue = 0;
    let dueToday = 0;
    let overdue = 0;
    let balanceDue = 0;
    for (const order of openOrders) {
      const remaining = Number(order.remaining);
      balanceDue += remaining;
      const due = calendarDay(order.dueDate);
      if (!due || due > today) notYetDue += remaining;
      else if (due === today) dueToday += remaining;
      else overdue += remaining;
    }

    const rowQuery = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED });
    if (status === 'open') rowQuery.andWhere('o.remaining > 0');
    if (status === 'settled') rowQuery.andWhere('o.remaining <= 0');
    rowQuery.orderBy('o.dueDate', 'ASC').addOrderBy('o.id', 'DESC').take(500);
    const listed = await rowQuery.getMany();

    const paymentQuery = this.dataSource
      .getRepository(OrderPayment)
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amount), 0)', 'collected');
    if (query.from) {
      paymentQuery.andWhere('payment.paid_at >= :from', {
        from: `${query.from} 00:00:00`,
      });
    }
    if (query.to) {
      paymentQuery.andWhere('payment.paid_at <= :to', {
        to: `${query.to} 23:59:59`,
      });
    }
    const collectedRaw = await paymentQuery.getRawOne<{ collected: string }>();

    return {
      stats: {
        balanceDue,
        openCount: openOrders.length,
        collected: Number(collectedRaw?.collected ?? 0),
      },
      aging: [
        { bucket: 'not_yet_due' as const, total: notYetDue },
        { bucket: 'due_today' as const, total: dueToday },
        { bucket: 'overdue' as const, total: overdue },
      ],
      rows: listed.map((order) => {
        const remaining = Number(order.remaining);
        const due = calendarDay(order.dueDate);
        let bucket: 'not_yet_due' | 'due_today' | 'overdue' | 'settled' =
          'settled';
        if (remaining > 0) {
          if (!due || due > today) bucket = 'not_yet_due';
          else if (due === today) bucket = 'due_today';
          else bucket = 'overdue';
        }
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          receiptNumber: order.receiptNumber,
          type: order.type,
          dueDate: due,
          total: Number(order.total),
          paid: Number(order.paid),
          remaining,
          paymentMethod: order.paymentMethod,
          customerId: order.customerId,
          customerName: order.customer?.name ?? null,
          customerPhone: order.customer?.phone ?? null,
          needsCustomer: remaining > 0 && !order.customerId,
          bucket,
        };
      }),
    };
  }

  async addReceipt(
    orderId: number,
    dto: { amount: number; paymentMethod: PaymentMethod; paidAt?: string },
  ) {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order is cancelled');
      }
      const remaining = Number(order.remaining);
      const amount = Number(dto.amount);
      if (!(amount > 0)) {
        throw new BadRequestException('Receipt amount must be greater than zero');
      }
      if (amount - remaining > 0.009) {
        throw new BadRequestException('Receipt amount exceeds the balance due');
      }
      if (!order.customerId) {
        throw new BadRequestException('A registered customer is required');
      }
      await this.recordReceipt(
        manager,
        order.id,
        amount,
        dto.paymentMethod,
        dto.paidAt ? new Date(dto.paidAt) : new Date(),
      );
      order.paid = Number(order.paid) + amount;
      order.remaining = Math.max(0, Number(order.total) - Number(order.paid));
      if (!order.paymentMethod) order.paymentMethod = dto.paymentMethod;
      await orderRepo.save(order);
      return order.id;
    });
    await this.notificationsService.generateDueNotificationsForDate(new Date());
    return this.findOne(savedId);
  }

  async attachCustomer(orderId: number, customerId: number) {
    const customer = await this.dataSource
      .getRepository(Customer)
      .findOneBy({ id: customerId });
    if (!customer) throw new NotFoundException('Customer not found');
    const order = await this.orderRepo.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId && order.customerId !== customerId) {
      throw new BadRequestException('This invoice already has a customer');
    }
    order.customerId = customerId;
    await this.orderRepo.save(order);
    return this.findOne(orderId);
  }
}
