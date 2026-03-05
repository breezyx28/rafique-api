import {
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/order.entity';

export class ReadyOrderItemDto {
  @IsNumber()
  inventoryItemId: number;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateReadyOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadyOrderItemDto)
  items: ReadyOrderItemDto[];

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
}
