import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderMeasurement } from './entities/order-measurement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Fabric } from '../inventory/entities/fabric.entity';
import { FabricStockMovement } from '../inventory/entities/fabric-stock-movement.entity';
import { OrderItemFabricConsumption } from './entities/order-item-fabric-consumption.entity';
import { OrderFabricSale } from './entities/order-fabric-sale.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderMeasurement,
      InventoryItem,
      Fabric,
      FabricStockMovement,
      OrderItemFabricConsumption,
      OrderFabricSale,
    ]),
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
