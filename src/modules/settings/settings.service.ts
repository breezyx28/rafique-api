import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './entities/app-setting.entity';

const DEFAULT_SETTINGS: Record<string, unknown> = {
  // General
  workshopName: '',
  workshopPhone: '',
  workshopAddress: '',
  logoUrl: '',
  // Preferences
  language: 'en',
  currency: 'SDG',
  dateFormat: 'YYYY-MM-DD',
  printer: '',
  showOrderSubmitConfirm: true,
  // Users
  adminName: '',
  adminUsername: '',
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private repo: Repository<AppSetting>,
  ) {}

  async get(key?: string) {
    if (key) {
      const row = await this.repo.findOne({ where: { key } });
      if (row) return row.value;
      if (key in DEFAULT_SETTINGS) {
        return DEFAULT_SETTINGS[key];
      }
      return null;
    }
    const rows = await this.repo.find();
    const current = rows.reduce(
      (acc, r) => ({ ...acc, [r.key]: r.value }),
      {} as Record<string, unknown>,
    );
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(k in current)) {
        current[k] = v;
      }
    }
    return current;
  }

  async set(key: string, value: Record<string, unknown> | string | number | boolean) {
    const existing = await this.repo.findOne({ where: { key } });
    const entity = Object.assign(existing ?? new AppSetting(), { key, value });
    await this.repo.save(entity);
    return this.get(key);
  }

  async patch(updates: Record<string, unknown>) {
    for (const [key, value] of Object.entries(updates)) {
      await this.set(key, value as Record<string, unknown> | string | number | boolean);
    }
    return this.get();
  }
}
