import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFabricDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  qty: number;

  @IsNumber()
  @Min(0)
  costPerUnit: number;
}
