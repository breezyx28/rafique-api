import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Fabric } from '../../inventory/entities/fabric.entity';
import { OrderItem } from './order-item.entity';

@Entity('order_item_fabric_consumptions')
export class OrderItemFabricConsumption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_item_id' })
  orderItemId: number;

  @Column({ name: 'fabric_id' })
  fabricId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  meters: number;

  @Column({ name: 'deducted_at', type: 'datetime', nullable: true })
  deductedAt: Date | null;

  @ManyToOne(() => OrderItem, (item) => item.fabricConsumptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @ManyToOne(() => Fabric, (fabric) => fabric.consumptions)
  @JoinColumn({ name: 'fabric_id' })
  fabric: Fabric;
}
