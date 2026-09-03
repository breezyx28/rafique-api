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

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  packageMeters?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packagePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPricePerMeter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sewingRatePerMeter?: number;
}
