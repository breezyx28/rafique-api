import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string | null;

  @Column({ type: 'int', default: 0 })
  qty: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @ManyToOne(() => Product, (p) => p.inventoryItems)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
