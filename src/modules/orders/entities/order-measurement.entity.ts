import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';
import type { ProductField } from '../../products/entities/product-field.entity';

@Entity('order_measurements')
export class OrderMeasurement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_item_id' })
  orderItemId: number;

  @Column({ name: 'field_id' })
  fieldId: number;

  @Column({ type: 'text' })
  value: string;

  @ManyToOne(() => OrderItem, (oi) => oi.measurements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @ManyToOne('ProductField')
  @JoinColumn({ name: 'field_id' })
  field: ProductField;
}
