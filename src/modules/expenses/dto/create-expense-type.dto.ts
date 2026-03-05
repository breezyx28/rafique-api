import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateExpenseTypeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}
