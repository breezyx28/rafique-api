import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { Fabric } from './entities/fabric.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateFabricDto } from './dto/create-fabric.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Product, ProductType } from '../products/entities/product.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private itemRepo: Repository<InventoryItem>,
    @InjectRepository(Fabric)
    private fabricRepo: Repository<Fabric>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    private notificationsService: NotificationsService,
  ) {}

  async findAllItems(pagination: PaginationDto) {
    const { page = 1, limit = 50 } = pagination;
    const [items, total] = await this.itemRepo.findAndCount({
      relations: ['product', 'fabric'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: items, meta: { page, limit, total } };
  }

  async createItem(dto: CreateInventoryItemDto) {
    const product = await this.productRepo.findOneBy({ id: dto.productId });
    if (!product) throw new NotFoundException('Product not found');
    if (product.type !== ProductType.READY) {
      throw new BadRequestException('Only ready products can be stocked');
    }
    const item = this.itemRepo.create(dto);
    const saved = await this.itemRepo.save(item);
    await this.notificationsService.createStockNotificationIfNeeded(saved.id);
    return this.itemRepo.findOne({
      where: { id: saved.id },
      relations: ['product', 'fabric'],
    });
  }

  async updateItem(id: number, dto: Partial<CreateInventoryItemDto>) {
    await this.itemRepo.update(id, dto);
    const item = await this.itemRepo.findOne({ where: { id }, relations: ['product', 'fabric'] });
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
    const fabric = this.fabricRepo.create(this.withPackagePricing(dto));
    return this.fabricRepo.save(fabric);
  }

  async updateFabric(id: number, dto: Partial<CreateFabricDto>) {
    const current = await this.fabricRepo.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Fabric not found');
    Object.assign(current, this.withPackagePricing({ ...current, ...dto }));
    return this.fabricRepo.save(current);
  }

  private withPackagePricing<T extends Partial<CreateFabricDto>>(dto: T) {
    const packageMeters = Number(dto.packageMeters ?? 20) || 20;
    const packagePrice = Number(
      dto.packagePrice ?? dto.costPerUnit ?? 0,
    );
    const sellingPricePerMeter =
      packageMeters > 0 ? packagePrice / packageMeters : 0;
    const totalMeters =
      dto.packageQty != null
        ? Number(dto.packageQty) * packageMeters
        : Number(dto.qty ?? 0);
    const { packageQty: _packageQty, ...rest } = dto;
    return {
      ...rest,
      qty: totalMeters,
      packageMeters,
      packagePrice,
      costPerUnit: packagePrice,
      sellingPricePerMeter:
        dto.sellingPricePerMeter != null
          ? Number(dto.sellingPricePerMeter)
          : sellingPricePerMeter,
    };
  }

  async removeFabric(id: number) {
    const fabric = await this.fabricRepo.findOne({ where: { id } });
    if (!fabric) throw new NotFoundException('Fabric not found');
    await this.fabricRepo.remove(fabric);
    return { ok: true };
  }
}
