import { Controller, Patch, Param, Body, UseGuards, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/password')
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.updatePassword(parseInt(id, 10), dto.password);
    return { ok: true };
  }
}
