import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Fabric } from '../../inventory/entities/fabric.entity';
import { Order } from './order.entity';

@Entity('order_fabric_sales')
export class OrderFabricSale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @Column({ name: 'fabric_id' })
  fabricId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  meters: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @ManyToOne(() => Order, (order) => order.fabricSales, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Fabric, (fabric) => fabric.sales)
  @JoinColumn({ name: 'fabric_id' })
  fabric: Fabric;
}
