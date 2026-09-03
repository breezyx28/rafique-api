import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Fabric } from './fabric.entity';

export enum FabricMovementType {
  RESTOCK = 'restock',
  ADJUSTMENT = 'adjustment',
  DIRECT_SALE = 'direct_sale',
  WORKSHOP_CONSUMPTION = 'workshop_consumption',
  REVERSAL = 'reversal',
}

@Entity('fabric_stock_movements')
export class FabricStockMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fabric_id' })
  fabricId: number;

  @Column({ type: 'enum', enum: FabricMovementType })
  type: FabricMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  meters: number;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @Column({ name: 'order_item_id', type: 'int', nullable: true })
  orderItemId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Fabric, (fabric) => fabric.movements)
  @JoinColumn({ name: 'fabric_id' })
  fabric: Fabric;
}
