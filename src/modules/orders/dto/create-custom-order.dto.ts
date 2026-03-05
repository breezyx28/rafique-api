import {
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class OrderItemMeasurementDto {
  @IsNumber()
  fieldId: number;

  @IsString()
  value: string;
}

export class OrderItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  unitPrice: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemMeasurementDto)
  measurements: OrderItemMeasurementDto[];
}

export class CreateCustomOrderDto {
  @IsNumber()
  customerId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNumber()
  total: number;

  @IsNumber()
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

  @IsOptional()
  @IsString()
  noteWorkshop?: string;
}
