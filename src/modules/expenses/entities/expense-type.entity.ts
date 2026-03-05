import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { Expense } from './expense.entity';

@Entity('expense_types')
export class ExpenseType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'is_custom', default: true })
  isCustom: boolean;

  @OneToMany('Expense', (e: Expense) => e.type)
  expenses: Expense[];
}
