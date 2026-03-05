import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationKind } from './entities/notification.entity';
import { Order } from '../orders/entities/order.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

export const LOW_STOCK_THRESHOLD = 6;

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(InventoryItem)
    private inventoryRepo: Repository<InventoryItem>,
  ) {}

  async findAll(limit = 20) {
    const notifications = await this.notificationRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return notifications;
  }

  async markRead(id: number) {
    await this.notificationRepo.update(id, { isRead: true });
  }

  async markAllRead() {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('is_read = :isRead', { isRead: false })
      .execute();
  }

  async createStockNotificationIfNeeded(itemId: number) {
    const item = await this.inventoryRepo.findOne({
      where: { id: itemId },
      relations: ['product'],
    });
    if (!item) return;

    if (item.qty > LOW_STOCK_THRESHOLD) {
      return;
    }

    const existing = await this.notificationRepo.findOne({
      where: {
        kind: 'stock',
        inventoryItemId: item.id,
        isRead: false,
      },
    });
    if (existing) return;

    const title = `Low stock: ${item.product?.name ?? 'Item'} (qty ${item.qty})`;

    const notification = this.notificationRepo.create({
      title,
      subtitle: 'Inventory alert',
      kind: 'stock',
      inventoryItemId: item.id,
      orderId: null,
      window: null,
      isRead: false,
    });
    await this.notificationRepo.save(notification);
  }

  async generateDueNotificationsForDate(date: Date) {
    const isoDate = date.toISOString().slice(0, 10);
    const today = new Date(isoDate);

    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o.dueDate IS NOT NULL')
      .andWhere('o.status IN (:...statuses)', {
        statuses: ['pending', 'in_progress', 'ready'],
      })
      .getMany();

    for (const order of orders) {
      if (!order.dueDate) continue;
      const due = new Date(order.dueDate);
      const diffMs = due.getTime() - today.getTime();
      const daysUntilDue = Math.round(diffMs / (24 * 60 * 60 * 1000));

      let window: string | null = null;
      let suffix: string | null = null;
      if (daysUntilDue === 2) {
        window = 'due_in_2';
        suffix = 'due in 2 days';
      } else if (daysUntilDue === 1) {
        window = 'due_tomorrow';
        suffix = 'due tomorrow';
      } else if (daysUntilDue === 0) {
        window = 'due_today';
        suffix = 'due today';
      }

      if (!window || !suffix) continue;

      const existing = await this.notificationRepo.findOne({
        where: {
          kind: 'due',
          orderId: order.id,
          window,
        },
      });
      if (existing) continue;

      const title = `Order #${order.orderNumber} ${suffix}`;
      const subtitle = order.customer
        ? `Customer: ${order.customer.name}`
        : null;

      const notification = this.notificationRepo.create({
        title,
        subtitle,
        kind: 'due',
        orderId: order.id,
        inventoryItemId: null,
        window,
        isRead: false,
      });
      await this.notificationRepo.save(notification);
    }
  }
}

