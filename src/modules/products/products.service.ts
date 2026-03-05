import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductType } from './entities/product.entity';
import { ProductField } from './entities/product-field.entity';
import { ProductFieldI18n } from './entities/product-field-i18n.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductFieldDto } from './dto/create-product-field.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(ProductField)
    private fieldRepo: Repository<ProductField>,
    @InjectRepository(ProductFieldI18n)
    private i18nRepo: Repository<ProductFieldI18n>,
  ) {}

  async findAll(type?: ProductType) {
    const where = type ? { type } : {};
    return this.productRepo.find({
      where,
      relations: ['fields', 'fields.i18n'],
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['fields', 'fields.i18n'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto) {
    const product = this.productRepo.create(dto);
    return this.productRepo.save(product);
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.productRepo.update(id, dto as Partial<Product>);
    return this.findOne(id);
  }

  async remove(id: number) {
    const product = await this.findOne(id);
    await this.productRepo.remove(product);
    return { ok: true };
  }

  async getFields(productId: number) {
    await this.findOne(productId);
    return this.fieldRepo.find({
      where: { productId },
      relations: ['i18n'],
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async addField(productId: number, dto: CreateProductFieldDto) {
    await this.findOne(productId);
    const maxOrder = await this.fieldRepo
      .createQueryBuilder('f')
      .select('MAX(f.sortOrder)', 'max')
      .where('f.productId = :id', { id: productId })
      .getRawOne();
    const field = this.fieldRepo.create({
      productId,
      fieldKey: dto.fieldKey,
      inputType: dto.inputType ?? 'text',
      required: dto.required ?? false,
      sortOrder: (maxOrder?.max ?? 0) + 1,
    });
    const saved = await this.fieldRepo.save(field);
    if (dto.labels?.length) {
      for (const label of dto.labels) {
        const lang = label.lang ?? (label as { language?: 'en' | 'ar' | 'bn' }).language;
        if (lang) {
          const i18n = this.i18nRepo.create({ fieldId: saved.id, lang, label: label.label });
          await this.i18nRepo.save(i18n);
        }
      }
    }
    return this.fieldRepo.findOne({
      where: { id: saved.id },
      relations: ['i18n'],
    });
  }

  async updateField(fieldId: number, dto: Partial<CreateProductFieldDto>) {
    const field = await this.fieldRepo.findOne({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    if (dto.fieldKey != null) field.fieldKey = dto.fieldKey;
    if (dto.inputType != null) field.inputType = dto.inputType;
    if (dto.required != null) field.required = dto.required;
    await this.fieldRepo.save(field);
    if (dto.labels?.length) {
      await this.i18nRepo.delete({ fieldId });
      for (const label of dto.labels) {
        const lang = label.lang ?? (label as { language?: 'en' | 'ar' | 'bn' }).language;
        if (lang) {
          const i18n = this.i18nRepo.create({ fieldId, lang, label: label.label });
          await this.i18nRepo.save(i18n);
        }
      }
    }
    return this.fieldRepo.findOne({
      where: { id: fieldId },
      relations: ['i18n'],
    });
  }

  async removeField(fieldId: number) {
    const field = await this.fieldRepo.findOne({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');
    await this.fieldRepo.remove(field);
    return { ok: true };
  }
}
