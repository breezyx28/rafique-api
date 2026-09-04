import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @Type(() => Number)
  @IsNumber()
  productId: number;

  @IsOptional()
  @IsString()
  size?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fabricId?: number;
}
