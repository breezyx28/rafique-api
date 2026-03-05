import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { Fabric } from './entities/fabric.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateFabricDto } from './dto/create-fabric.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private itemRepo: Repository<InventoryItem>,
    @InjectRepository(Fabric)
    private fabricRepo: Repository<Fabric>,
    private notificationsService: NotificationsService,
  ) {}

  async findAllItems(pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const [items, total] = await this.itemRepo.findAndCount({
      relations: ['product'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: items, meta: { page, limit, total } };
  }

  async createItem(dto: CreateInventoryItemDto) {
    const item = this.itemRepo.create(dto);
    const saved = await this.itemRepo.save(item);
    await this.notificationsService.createStockNotificationIfNeeded(saved.id);
    return saved;
  }

  async updateItem(id: number, dto: Partial<CreateInventoryItemDto>) {
    await this.itemRepo.update(id, dto);
    const item = await this.itemRepo.findOne({ where: { id }, relations: ['product'] });
    if (!item) throw new NotFoundException('Inventory item not found');
    await this.notificationsService.createStockNotificationIfNeeded(item.id);
    return item;
  }

  async removeItem(id: number) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    await this.itemRepo.remove(item);
    return { ok: true };
  }

  async findAllFabrics(pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const [items, total] = await this.fabricRepo.findAndCount({
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: items, meta: { page, limit, total } };
  }

  async createFabric(dto: CreateFabricDto) {
    const fabric = this.fabricRepo.create(dto);
    return this.fabricRepo.save(fabric);
  }

  async updateFabric(id: number, dto: Partial<CreateFabricDto>) {
    await this.fabricRepo.update(id, dto);
    const fabric = await this.fabricRepo.findOne({ where: { id } });
    if (!fabric) throw new NotFoundException('Fabric not found');
    return fabric;
  }

  async removeFabric(id: number) {
    const fabric = await this.fabricRepo.findOne({ where: { id } });
    if (!fabric) throw new NotFoundException('Fabric not found');
    await this.fabricRepo.remove(fabric);
    return { ok: true };
  }
}
