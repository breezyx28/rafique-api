import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';
import { OrderMeasurement } from './order-measurement.entity';
import { OrderItemFabricConsumption } from './order-item-fabric-consumption.entity';

export enum WorkshopItemStatus {
  NOT_READY = 'not_ready',
  READY = 'ready',
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ name: 'inventory_item_id', type: 'int', nullable: true })
  inventoryItemId: number | null;

  @Column({ type: 'int', default: 1 })
  qty: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column({
    name: 'workshop_status',
    type: 'enum',
    enum: WorkshopItemStatus,
    default: WorkshopItemStatus.NOT_READY,
  })
  workshopStatus: WorkshopItemStatus;

  @Column({ name: 'ready_at', type: 'datetime', nullable: true })
  readyAt: Date | null;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, (p) => p.orderItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => OrderMeasurement, (m) => m.orderItem)
  measurements: OrderMeasurement[];

  @OneToMany(() => OrderItemFabricConsumption, (row) => row.orderItem)
  fabricConsumptions: OrderItemFabricConsumption[];
}
