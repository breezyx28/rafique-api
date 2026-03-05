import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'json', nullable: true })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => User, (u) => u.role)
  users: User[];
}
