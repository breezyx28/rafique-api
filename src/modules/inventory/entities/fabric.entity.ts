import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { OrderItemFabricConsumption } from '../../orders/entities/order-item-fabric-consumption.entity';
import { OrderFabricSale } from '../../orders/entities/order-fabric-sale.entity';
import { FabricStockMovement } from './fabric-stock-movement.entity';

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

  @Column({
    name: 'package_meters',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 20,
  })
  packageMeters: number;

  @Column({
    name: 'package_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  packagePrice: number;

  @Column({
    name: 'selling_price_per_meter',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  sellingPricePerMeter: number;

  @Column({
    name: 'sewing_rate_per_meter',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  sewingRatePerMeter: number;

  @OneToMany(() => OrderItemFabricConsumption, (row) => row.fabric)
  consumptions: OrderItemFabricConsumption[];

  @OneToMany(() => OrderFabricSale, (row) => row.fabric)
  sales: OrderFabricSale[];

  @OneToMany(() => FabricStockMovement, (row) => row.fabric)
  movements: FabricStockMovement[];
}
