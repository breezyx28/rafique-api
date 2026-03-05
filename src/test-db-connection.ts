import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { typeOrmConfig } from './config/typeorm.config';

async function testConnection() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: false, logging: false });

  try {
    await ds.initialize();
    await ds.query('SELECT 1');
    console.log('Database connection successful.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exitCode = 1;
  } finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}

testConnection();

