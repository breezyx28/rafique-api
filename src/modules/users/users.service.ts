import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { username },
      relations: ['role'],
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ['role'],
      select: ['id', 'username', 'roleId', 'createdAt'],
    });
  }

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, { passwordHash: hash });
  }

  async findAll() {
    return this.userRepo.find({
      relations: ['role'],
      select: ['id', 'username', 'roleId', 'createdAt'],
      order: { id: 'ASC' },
    });
  }
}
