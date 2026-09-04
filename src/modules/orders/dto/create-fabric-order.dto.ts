import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class FabricSaleItemDto {
  @Type(() => Number)
  @IsNumber()
  fabricId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  meters: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateFabricOrderDto {
  @Type(() => Number)
  @IsNumber()
  customerId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FabricSaleItemDto)
  items: FabricSaleItemDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paid: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  noteCustomer?: string;
}
