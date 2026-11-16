import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { Fabric } from '../inventory/entities/fabric.entity';
import {
  FabricMovementType,
  FabricStockMovement,
} from '../inventory/entities/fabric-stock-movement.entity';
import {
  Order,
  OrderStatus,
  OrderType,
} from '../orders/entities/order.entity';
import {
  OrderItem,
  WorkshopItemStatus,
} from '../orders/entities/order-item.entity';
import { OrderItemFabricConsumption } from '../orders/entities/order-item-fabric-consumption.entity';
import { Product, ProductType } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { CreateWagePayoutDto } from './dto/create-wage-payout.dto';
import { WorkshopWagePayout } from './entities/workshop-wage-payout.entity';

@Injectable()
export class WorkshopService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemFabricConsumption)
    private readonly consumptionRepo: Repository<OrderItemFabricConsumption>,
    @InjectRepository(WorkshopWagePayout)
    private readonly payoutRepo: Repository<WorkshopWagePayout>,
    private readonly dataSource: DataSource,
  ) {}

  private readonly workshopRelations = [
    'customer',
    'items',
    'items.product',
    'items.measurements',
    'items.measurements.field',
    'items.measurements.field.i18n',
    'items.fabricConsumptions',
    'items.fabricConsumptions.fabric',
  ];

  async listDelivered() {
    return this.orderRepo.find({
      where: {
        type: OrderType.CUSTOM,
        workshopDeliveredAt: Not(IsNull()),
      },
      relations: this.workshopRelations,
      order: { workshopDeliveredAt: 'DESC' },
    });
  }

  async deliver(orderId: number) {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const fabricRepo = manager.getRepository(Fabric);
      const consumptionRepo = manager.getRepository(
        OrderItemFabricConsumption,
      );
      const movementRepo = manager.getRepository(FabricStockMovement);

      const locked = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');
      const order = await orderRepo.findOne({
        where: { id: orderId },
        relations: ['items', 'items.fabricConsumptions'],
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.type !== OrderType.CUSTOM) {
        throw new BadRequestException('Only custom orders can go to workshop');
      }
      if (order.workshopDeliveredAt) return;
      if (
        !order.items.length ||
        order.items.some((item) => !item.fabricConsumptions?.length)
      ) {
        throw new BadRequestException(
          'Every order item must have fabric and meters before workshop delivery',
        );
      }

      const allConsumptions = order.items.flatMap(
        (item) => item.fabricConsumptions,
      );
      const totals = new Map<number, number>();
      for (const row of allConsumptions) {
        totals.set(
          row.fabricId,
          (totals.get(row.fabricId) ?? 0) + Number(row.meters),
        );
      }

      for (const [fabricId, meters] of totals) {
        const fabric = await fabricRepo.findOne({
          where: { id: fabricId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!fabric) throw new NotFoundException(`Fabric ${fabricId} not found`);
        if (Number(fabric.qty) < meters) {
          throw new BadRequestException(`Insufficient meters for ${fabric.name}`);
        }
        fabric.qty = Number(fabric.qty) - meters;
        await fabricRepo.save(fabric);
      }

      const deductedAt = new Date();
      for (const row of allConsumptions) {
        row.deductedAt = deductedAt;
        await consumptionRepo.save(row);
        await movementRepo.save(
          movementRepo.create({
            fabricId: row.fabricId,
            type: FabricMovementType.WORKSHOP_CONSUMPTION,
            meters: -Number(row.meters),
            orderId: order.id,
            orderItemId: row.orderItemId,
            note: 'Consumed on workshop delivery',
          }),
        );
      }

      order.workshopDeliveredAt = deductedAt;
      order.status = OrderStatus.IN_PROGRESS;
      await orderRepo.save(order);
    });
    return this.getOrder(orderId);
  }

  async undoDeliver(orderId: number) {
    const undoWindowMs = 30_000;
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const fabricRepo = manager.getRepository(Fabric);
      const consumptionRepo = manager.getRepository(
        OrderItemFabricConsumption,
      );
      const movementRepo = manager.getRepository(FabricStockMovement);

      const locked = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');
      const order = await orderRepo.findOne({
        where: { id: orderId },
        relations: ['items', 'items.fabricConsumptions'],
      });
      if (!order) throw new NotFoundException('Order not found');
      if (!order.workshopDeliveredAt) {
        throw new BadRequestException('Order is not in the workshop');
      }
      const elapsed =
        Date.now() - new Date(order.workshopDeliveredAt).getTime();
      if (elapsed > undoWindowMs) {
        throw new BadRequestException(
          'Undo window expired. Delete the order to start again.',
        );
      }

      const consumptions = order.items.flatMap(
        (item) => item.fabricConsumptions ?? [],
      );
      for (const row of consumptions) {
        if (!row.deductedAt) continue;
        const fabric = await fabricRepo.findOne({
          where: { id: row.fabricId },
          lock: { mode: 'pessimistic_write' },
        });
        if (fabric) {
          fabric.qty = Number(fabric.qty) + Number(row.meters);
          await fabricRepo.save(fabric);
        }
        row.deductedAt = null;
        await consumptionRepo.save(row);
        await movementRepo.save(
          movementRepo.create({
            fabricId: row.fabricId,
            type: FabricMovementType.REVERSAL,
            meters: Number(row.meters),
            orderId: order.id,
            orderItemId: row.orderItemId,
            note: 'Undo workshop delivery',
          }),
        );
      }

      for (const item of order.items) {
        item.workshopStatus = WorkshopItemStatus.NOT_READY;
        item.readyAt = null;
        item.sewingRateApplied = null;
        await itemRepo.save(item);
      }

      order.workshopDeliveredAt = null;
      order.readyForReceiveAt = null;
      order.receiptNumber = null;
      order.status = OrderStatus.PENDING;
      await orderRepo.save(order);
    });
    return this.getOrder(orderId);
  }

  async setItemReadiness(itemId: number, ready: boolean) {
    const orderId = await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(OrderItem);
      const orderRepo = manager.getRepository(Order);
      const item = await itemRepo.findOne({
        where: { id: itemId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) throw new NotFoundException('Order item not found');
      const parent = await orderRepo.findOne({
        where: { id: item.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!parent?.workshopDeliveredAt) {
        throw new BadRequestException('Order has not been delivered to workshop');
      }

      item.workshopStatus = ready
        ? WorkshopItemStatus.READY
        : WorkshopItemStatus.NOT_READY;
      item.readyAt = ready ? new Date() : null;
      if (ready) {
        const product = await manager.getRepository(Product).findOneBy({
          id: item.productId,
        });
        item.sewingRateApplied = Number(product?.sewingPrice ?? 0);
      } else {
        item.sewingRateApplied = null;
      }
      await itemRepo.save(item);

      const siblings = await itemRepo.find({
        where: { orderId: item.orderId },
      });
      const allReady = siblings.every(
        (row) => row.workshopStatus === WorkshopItemStatus.READY,
      );
      const order = await orderRepo.findOneByOrFail({ id: item.orderId });
      if (allReady) {
        order.status = OrderStatus.READY;
        order.readyForReceiveAt = order.readyForReceiveAt ?? new Date();
        order.receiptNumber = order.receiptNumber ?? `REC-${order.orderNumber}`;
      } else {
        order.status = OrderStatus.IN_PROGRESS;
      }
      await orderRepo.save(order);
      return item.orderId;
    });
    return this.getOrder(orderId);
  }

  async getPayroll(filters?: {
    from?: string;
    to?: string;
    productId?: number;
  }) {
    const [breakdown, totalAccrued, totalPaid] = await Promise.all([
      this.buildPayrollBreakdown(filters),
      this.computeTotalAccrued(),
      this.computeTotalPaid(),
    ]);

    const periodPieces = breakdown.reduce((sum, row) => sum + row.pieces, 0);
    const periodMeters = breakdown.reduce((sum, row) => sum + row.meters, 0);
    const periodTotal = breakdown.reduce((sum, row) => sum + row.amount, 0);
    const outstandingBalance = this.roundMoney(
      Math.max(0, totalAccrued - totalPaid),
    );

    return {
      breakdown,
      total: periodTotal,
      periodTotals: {
        pieces: periodPieces,
        meters: this.roundMoney(periodMeters),
        amount: periodTotal,
      },
      totalAccrued,
      totalPaid,
      outstandingBalance,
    };
  }

  async listWagePayouts(filters?: { from?: string; to?: string }) {
    const qb = this.payoutRepo
      .createQueryBuilder('payout')
      .leftJoinAndSelect('payout.createdBy', 'createdBy')
      .orderBy('payout.createdAt', 'DESC');

    if (filters?.from) {
      qb.andWhere('DATE(payout.created_at) >= :from', { from: filters.from });
    }
    if (filters?.to) {
      qb.andWhere('DATE(payout.created_at) <= :to', { to: filters.to });
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.serializePayout(row));
  }

  async createWagePayout(dto: CreateWagePayoutDto, userId: number) {
    const amount = this.roundMoney(Number(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('Authenticated user is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const payoutRepo = manager.getRepository(WorkshopWagePayout);
      const totalAccrued = await this.computeTotalAccrued(manager);
      const totalPaid = await this.computeTotalPaid(manager);
      const outstandingBalance = this.roundMoney(
        Math.max(0, totalAccrued - totalPaid),
      );

      if (amount > outstandingBalance) {
        throw new BadRequestException(
          'Payout amount cannot exceed the outstanding balance',
        );
      }

      const balanceBefore = outstandingBalance;
      const balanceAfter = this.roundMoney(balanceBefore - amount);
      const note = dto.note?.trim() ? dto.note.trim() : null;

      const saved = await payoutRepo.save(
        payoutRepo.create({
          amount,
          balanceBefore,
          balanceAfter,
          note,
          createdByUserId: userId,
          createdBy: { id: userId } as User,
        }),
      );

      const withUser = await payoutRepo.findOne({
        where: { id: saved.id },
        relations: ['createdBy'],
      });

      const nextPaid = this.roundMoney(totalPaid + amount);
      return {
        payout: this.serializePayout(withUser ?? saved),
        totalAccrued,
        totalPaid: nextPaid,
        outstandingBalance: balanceAfter,
      };
    });
  }

  async productivity() {
    return this.listDelivered();
  }

  private async buildPayrollBreakdown(filters?: {
    from?: string;
    to?: string;
    productId?: number;
  }) {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .leftJoin('item.fabricConsumptions', 'consumption')
      .select('item.id', 'itemId')
      .addSelect('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('item.qty', 'qty')
      .addSelect(
        'COALESCE(item.sewing_rate_applied, product.sewing_price)',
        'rate',
      )
      .addSelect('COALESCE(SUM(consumption.meters), 0)', 'meters')
      .where('item.workshopStatus = :status', {
        status: WorkshopItemStatus.READY,
      })
      .andWhere('product.type = :type', { type: ProductType.CUSTOM });

    if (filters?.from) {
      qb.andWhere('DATE(item.ready_at) >= :from', { from: filters.from });
    }
    if (filters?.to) {
      qb.andWhere('DATE(item.ready_at) <= :to', { to: filters.to });
    }
    if (filters?.productId != null) {
      qb.andWhere('product.id = :productId', { productId: filters.productId });
    }

    const rows = await qb
      .groupBy('item.id')
      .addGroupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('item.qty')
      .addGroupBy('COALESCE(item.sewing_rate_applied, product.sewing_price)')
      .getRawMany();

    const grouped = new Map<
      string,
      {
        productId: number;
        productName: string;
        pieces: number;
        meters: number;
        rate: number;
      }
    >();
    for (const row of rows) {
      const rate = Number(row.rate);
      const key = `${row.productId}:${rate}`;
      const current = grouped.get(key) ?? {
        productId: Number(row.productId),
        productName: String(row.productName),
        pieces: 0,
        meters: 0,
        rate,
      };
      current.pieces += Number(row.qty);
      current.meters += Number(row.meters);
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        meters: this.roundMoney(row.meters),
        amount: this.roundMoney(row.pieces * row.rate),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }

  private async computeTotalAccrued(manager?: EntityManager) {
    const repo = manager ? manager.getRepository(OrderItem) : this.itemRepo;
    const row = await repo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .select(
        'COALESCE(SUM(item.qty * COALESCE(item.sewing_rate_applied, product.sewing_price)), 0)',
        'total',
      )
      .where('item.workshopStatus = :status', {
        status: WorkshopItemStatus.READY,
      })
      .andWhere('product.type = :type', { type: ProductType.CUSTOM })
      .getRawOne<{ total?: string | number }>();
    return this.roundMoney(Number(row?.total ?? 0));
  }

  private async computeTotalPaid(manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(WorkshopWagePayout)
      : this.payoutRepo;
    const row = await repo
      .createQueryBuilder('payout')
      .select('COALESCE(SUM(payout.amount), 0)', 'total')
      .getRawOne<{ total?: string | number }>();
    return this.roundMoney(Number(row?.total ?? 0));
  }

  private serializePayout(row: WorkshopWagePayout) {
    return {
      id: row.id,
      amount: this.roundMoney(Number(row.amount)),
      balanceBefore: this.roundMoney(Number(row.balanceBefore)),
      balanceAfter: this.roundMoney(Number(row.balanceAfter)),
      note: row.note,
      createdAt: row.createdAt,
      createdByUserId: row.createdByUserId,
      createdByUsername: row.createdBy?.username ?? null,
    };
  }

  private roundMoney(value: number) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private async getOrder(orderId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: this.workshopRelations,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
