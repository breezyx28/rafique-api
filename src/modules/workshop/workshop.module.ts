import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderItemFabricConsumption } from '../orders/entities/order-item-fabric-consumption.entity';
import { WorkshopController } from './workshop.controller';
import { WorkshopService } from './workshop.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderItemFabricConsumption,
    ]),
  ],
  controllers: [WorkshopController],
  providers: [WorkshopService],
})
export class WorkshopModule {}
