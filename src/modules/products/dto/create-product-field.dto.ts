import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductFieldLabelDto {
  @IsOptional()
  @IsIn(['en', 'ar', 'bn'])
  lang?: 'en' | 'ar' | 'bn';

  @IsOptional()
  @IsIn(['en', 'ar', 'bn'])
  language?: 'en' | 'ar' | 'bn';

  @IsString()
  label: string;
}

export class CreateProductFieldDto {
  @IsString()
  fieldKey: string;

  @IsString()
  inputType: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFieldLabelDto)
  labels?: { lang: 'en' | 'ar' | 'bn'; label: string }[];
}
