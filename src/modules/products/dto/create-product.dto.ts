import { IsString, IsEnum, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { ProductType } from '../entities/product.entity';

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEnum(ProductType)
  type: ProductType;

  @IsOptional()
  @IsNumber()
  basePrice?: number;
}
