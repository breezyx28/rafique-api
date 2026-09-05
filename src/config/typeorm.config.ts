import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../modules/users/entities/role.entity';
import { Customer } from '../modules/customers/entities/customer.entity';
import { Product } from '../modules/products/entities/product.entity';
import { ProductField } from '../modules/products/entities/product-field.entity';
import { ProductFieldI18n } from '../modules/products/entities/product-field-i18n.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { OrderItem } from '../modules/orders/entities/order-item.entity';
import { OrderMeasurement } from '../modules/orders/entities/order-measurement.entity';
import { OrderItemFabricConsumption } from '../modules/orders/entities/order-item-fabric-consumption.entity';
import { OrderFabricSale } from '../modules/orders/entities/order-fabric-sale.entity';
import { InventoryItem } from '../modules/inventory/entities/inventory-item.entity';
import { Fabric } from '../modules/inventory/entities/fabric.entity';
import { FabricStockMovement } from '../modules/inventory/entities/fabric-stock-movement.entity';
import { Expense } from '../modules/expenses/entities/expense.entity';
import { ExpenseType } from '../modules/expenses/entities/expense-type.entity';
import { Notification } from '../modules/notifications/entities/notification.entity';
import { AppSetting } from '../modules/settings/entities/app-setting.entity';

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
    : path.resolve(process.cwd(), '.env'),
});

export const typeOrmConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rafique_tailors_db',
  entities: [
    User,
    Role,
    Customer,
    Product,
    ProductField,
    ProductFieldI18n,
    Order,
    OrderItem,
    OrderMeasurement,
    OrderItemFabricConsumption,
    OrderFabricSale,
    InventoryItem,
    Fabric,
    FabricStockMovement,
    Expense,
    ExpenseType,
    Notification,
    AppSetting,
  ],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(typeOrmConfig);
export default dataSource;
