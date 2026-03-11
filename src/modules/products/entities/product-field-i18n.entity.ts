import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import type { ProductField } from './product-field.entity';

export type LangCode = 'en' | 'ar' | 'bn';

@Entity('product_field_i18n')
export class ProductFieldI18n {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'field_id' })
  fieldId: number;

  @Column({ type: 'enum', enum: ['en', 'ar', 'bn'] })
  lang: LangCode;

  @Column({ length: 255 })
  label: string;

  @ManyToOne('ProductField', 'i18n', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'field_id' })
  field: ProductField;
}
