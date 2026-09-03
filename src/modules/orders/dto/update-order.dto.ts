import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { OrderStatus, PaymentMethod } from '../entities/order.entity';

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paid?: number;

  @IsOptional()
  @IsNumber()
  remaining?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
