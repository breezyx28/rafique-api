import { IsBoolean } from 'class-validator';

export class SetReadinessDto {
  @IsBoolean()
  ready: boolean;
}
