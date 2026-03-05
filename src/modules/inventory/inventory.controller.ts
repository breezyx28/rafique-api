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
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateFabricDto } from './dto/create-fabric.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items')
  async findAllItems(@Query() pagination: PaginationDto) {
    return this.inventoryService.findAllItems(pagination);
  }

  @Post('items')
  async createItem(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createItem(dto);
  }

  @Patch('items/:id')
  async updateItem(@Param('id') id: string, @Body() dto: Partial<CreateInventoryItemDto>) {
    return this.inventoryService.updateItem(parseInt(id, 10), dto);
  }

  @Delete('items/:id')
  async removeItem(@Param('id') id: string) {
    return this.inventoryService.removeItem(parseInt(id, 10));
  }

  @Get('fabrics')
  async findAllFabrics(@Query() pagination: PaginationDto) {
    return this.inventoryService.findAllFabrics(pagination);
  }

  @Post('fabrics')
  async createFabric(@Body() dto: CreateFabricDto) {
    return this.inventoryService.createFabric(dto);
  }

  @Patch('fabrics/:id')
  async updateFabric(@Param('id') id: string, @Body() dto: Partial<CreateFabricDto>) {
    return this.inventoryService.updateFabric(parseInt(id, 10), dto);
  }

  @Delete('fabrics/:id')
  async removeFabric(@Param('id') id: string) {
    return this.inventoryService.removeFabric(parseInt(id, 10));
  }
}
