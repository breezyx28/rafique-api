import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
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

@Injectable()
export class WorkshopService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemFabricConsumption)
    private readonly consumptionRepo: Repository<OrderItemFabricConsumption>,
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

  async getPayroll() {
    const rows = await this.itemRepo
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
      .andWhere('product.type = :type', { type: ProductType.CUSTOM })
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

    const breakdown = [...grouped.values()].map((row) => ({
      ...row,
      amount: row.pieces * row.rate,
    }));
    return {
      breakdown,
      total: breakdown.reduce((sum, row) => sum + row.amount, 0),
    };
  }

  async productivity() {
    return this.listDelivered();
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
