import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('fabrics')
export class Fabric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50, default: 'meter' })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  qty: number;

  @Column({ name: 'cost_per_unit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  costPerUnit: number;
}
