import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationKind } from './entities/notification.entity';
import { Order } from '../orders/entities/order.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

export const LOW_STOCK_THRESHOLD = 6;

function dateOnly(value: Date | string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function diffDays(due: string, today: string): number {
  const [y1, m1, d1] = due.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  return Math.round(
    (Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000,
  );
}

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
    await this.generateDueNotificationsForDate(new Date());
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.notificationRepo.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async countUnread() {
    await this.generateDueNotificationsForDate(new Date());
    return this.notificationRepo.count({ where: { isRead: false } });
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
    const today = dateOnly(date);

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
      const daysUntilDue = diffDays(dateOnly(order.dueDate), today);

      let window: string | null = null;
      let title: string | null = null;
      if (daysUntilDue === 2) {
        window = 'due_in_2';
        title = `Order #${order.orderNumber} is due in 2 days`;
      } else if (daysUntilDue === 1) {
        window = 'due_tomorrow';
        title = `Order #${order.orderNumber} is due tomorrow`;
      } else if (daysUntilDue === 0) {
        window = 'due_today';
        title = `Delivery day is today: Order #${order.orderNumber}`;
      } else if (daysUntilDue < 0) {
        window = 'overdue';
        title = `Delivery date has passed: Order #${order.orderNumber}`;
      }

      if (!window || !title) continue;

      const existing = await this.notificationRepo.findOne({
        where: {
          kind: 'due',
          orderId: order.id,
          window,
        },
      });
      if (existing) continue;

      const subtitle = order.customer
        ? `Customer: ${order.customer.name}`
        : 'Follow up with the customer for pickup.';

      const notification = this.notificationRepo.create({
        title,
        subtitle,
        kind: 'due' as NotificationKind,
        orderId: order.id,
        inventoryItemId: null,
        window,
        isRead: false,
      });
      await this.notificationRepo.save(notification);
    }
  }
}
