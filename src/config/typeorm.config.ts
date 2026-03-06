import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
    : path.resolve(process.cwd(), '.env'),
});
import { DataSource, DataSourceOptions } from 'typeorm';

export const typeOrmConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rafique_tailors_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(typeOrmConfig);
export default dataSource;
