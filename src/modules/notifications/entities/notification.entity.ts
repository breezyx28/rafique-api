import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type NotificationKind = 'due' | 'stock';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subtitle: string | null;

  @Column({ type: 'enum', enum: ['due', 'stock'] })
  kind: NotificationKind;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  @Index()
  orderId: number | null;

  @Column({ name: 'inventory_item_id', type: 'int', nullable: true })
  @Index()
  inventoryItemId: number | null;

  @Column({ name: 'window', type: 'varchar', length: 20, nullable: true })
  @Index()
  window: string | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

