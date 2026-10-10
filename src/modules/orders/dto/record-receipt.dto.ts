import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '../entities/order.entity';

export class RecordReceiptDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class AttachCustomerDto {
  @IsNumber()
  customerId: number;
}
