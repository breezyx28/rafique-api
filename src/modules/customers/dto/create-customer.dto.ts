import { IsString, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
