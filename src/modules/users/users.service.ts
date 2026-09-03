import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
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

  async create(dto: CreateUserDto) {
    if (await this.findByUsername(dto.username)) {
      throw new ConflictException('Username already exists');
    }
    let role = await this.roleRepo.findOneBy({ name: dto.role });
    if (!role) {
      role = await this.roleRepo.save(
        this.roleRepo.create({ name: dto.role, permissions: [] }),
      );
    }
    const user = await this.userRepo.save(
      this.userRepo.create({
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        roleId: role.id,
      }),
    );
    const created = await this.findById(user.id);
    if (!created) throw new NotFoundException('Created user not found');
    return created;
  }
}
