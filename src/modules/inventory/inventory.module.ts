import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { Fabric } from './entities/fabric.entity';
import { FabricStockMovement } from './entities/fabric-stock-movement.entity';
import { Product } from '../products/entities/product.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, Fabric, FabricStockMovement, Product]),
    NotificationsModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
