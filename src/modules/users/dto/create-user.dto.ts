import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['Admin', 'Cashier', 'Workshop'])
  role: 'Admin' | 'Cashier' | 'Workshop';
}
