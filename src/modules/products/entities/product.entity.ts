import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { ProductField } from './product-field.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

export enum ProductType {
  CUSTOM = 'custom',
  READY = 'ready',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'enum', enum: ProductType, default: ProductType.CUSTOM })
  type: ProductType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  basePrice: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProductField, (f) => f.product)
  fields: ProductField[];

  @OneToMany(() => OrderItem, (oi) => oi.product)
  orderItems: OrderItem[];

  @OneToMany(() => InventoryItem, (i) => i.product)
  inventoryItems: InventoryItem[];
}
