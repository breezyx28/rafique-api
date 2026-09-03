import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class FabricSaleItemDto {
  @IsNumber()
  fabricId: number;

  @IsNumber()
  @Min(0.01)
  meters: number;
}

export class CreateFabricOrderDto {
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FabricSaleItemDto)
  items: FabricSaleItemDto[];

  @IsNumber()
  @Min(0)
  paid: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
