import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'json', nullable: true })
  value: unknown;
}
