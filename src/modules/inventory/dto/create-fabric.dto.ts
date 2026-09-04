import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFabricDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  packageMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  packagePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPricePerMeter?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sewingRatePerMeter?: number;
}
