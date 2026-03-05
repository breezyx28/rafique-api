import { IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsNumber()
  typeId: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  note?: string;
}
