import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { UpdateOrderDto } from './update-order.dto';

export class UpdateOrderItemFabricDto {
  @IsNumber()
  itemId: number;

  @IsNumber()
  fabricId: number;

  @IsNumber()
  @Min(0.01)
  fabricMeters: number;
}

export class UpdateCustomOrderDto extends UpdateOrderDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemFabricDto)
  items?: UpdateOrderItemFabricDto[];
}
