import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Product } from './product.entity';
import { ProductFieldI18n } from './product-field-i18n.entity';
import { OrderMeasurement } from '../../orders/entities/order-measurement.entity';

@Entity('product_fields')
export class ProductField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ name: 'field_key', length: 100 })
  fieldKey: string;

  @Column({ name: 'input_type', length: 20, default: 'text' })
  inputType: string;

  @Column({ default: false })
  required: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Product, (p) => p.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @OneToMany(() => ProductFieldI18n, (i18n) => i18n.field)
  i18n: ProductFieldI18n[];

  @OneToMany(() => OrderMeasurement, (m) => m.field)
  orderMeasurements: OrderMeasurement[];
}
