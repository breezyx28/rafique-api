import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductFieldDto } from './dto/create-product-field.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProductType } from './entities/product.entity';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query('type') type?: ProductType) {
    return this.productsService.findAll(type);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(parseInt(id, 10));
  }

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(parseInt(id, 10), dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(parseInt(id, 10));
  }

  @Get(':id/fields')
  async getFields(@Param('id') id: string) {
    return this.productsService.getFields(parseInt(id, 10));
  }

  @Post(':id/fields')
  async addField(
    @Param('id') id: string,
    @Body() dto: CreateProductFieldDto,
  ) {
    return this.productsService.addField(parseInt(id, 10), dto);
  }

  @Patch('fields/:fieldId')
  async updateField(
    @Param('fieldId') fieldId: string,
    @Body() dto: Partial<CreateProductFieldDto>,
  ) {
    return this.productsService.updateField(parseInt(fieldId, 10), dto);
  }

  @Delete('fields/:fieldId')
  async removeField(@Param('fieldId') fieldId: string) {
    return this.productsService.removeField(parseInt(fieldId, 10));
  }
}
