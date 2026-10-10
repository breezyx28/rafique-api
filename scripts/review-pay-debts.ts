import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DataSource, In } from 'typeorm'
import { AppModule } from '../src/app.module'
import { OrdersService } from '../src/modules/orders/orders.service'
import { WorkshopService } from '../src/modules/workshop/workshop.service'
import { NotificationsService } from '../src/modules/notifications/notifications.service'
import { ProductsService } from '../src/modules/products/products.service'
import { CustomersService } from '../src/modules/customers/customers.service'
import { CustomersController } from '../src/modules/customers/customers.controller'
import { ProductType } from '../src/modules/products/entities/product.entity'
import {
  Order,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from '../src/modules/orders/entities/order.entity'
import { OrderPayment } from '../src/modules/orders/entities/order-payment.entity'
import { Fabric } from '../src/modules/inventory/entities/fabric.entity'
import { FabricStockMovement } from '../src/modules/inventory/entities/fabric-stock-movement.entity'
import { InventoryItem } from '../src/modules/inventory/entities/inventory-item.entity'
import { Notification } from '../src/modules/notifications/entities/notification.entity'
import { ReceivablesAndSewingRate20261010000000 } from '../src/migrations/20261010000000-ReceivablesAndSewingRate'

const failures: string[] = []

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}`)
    return
  }
  const line = detail ? `${name} — ${detail}` : name
  failures.push(line)
  console.error(`FAIL  ${line}`)
}

function messageOf(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    return Array.isArray(message) ? message.join(' ') : String(message)
  }
  return String(error)
}

function dayOffset(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] })
  const dataSource = app.get(DataSource)
  const orders = app.get(OrdersService)
  const workshop = app.get(WorkshopService)
  const notifications = app.get(NotificationsService)
  const products = app.get(ProductsService)
  const customers = app.get(CustomersService)
  const customersController = app.get(CustomersController)
  const orderIds: number[] = []
  const productIds: number[] = []
  let customerId = 0
  let fabricId = 0
  let inventoryId = 0

  try {
    const runner = dataSource.createQueryRunner()
    await new ReceivablesAndSewingRate20261010000000().up(runner)
    const migrationsTable = await runner.query(`SHOW TABLES LIKE 'migrations'`)
    if (migrationsTable.length) {
      const recorded = await runner.query(
        `SELECT id FROM migrations WHERE name = 'ReceivablesAndSewingRate20261010000000'`,
      )
      if (!recorded.length) {
        await runner.query(
          `INSERT INTO migrations (timestamp, name) VALUES (20261010000000, 'ReceivablesAndSewingRate20261010000000')`,
        )
      }
    }
    const [rateColumn] = await runner.query(
      `SHOW COLUMNS FROM order_items LIKE 'sewing_rate_applied'`,
    )
    const [paymentsTable] = await runner.query(`SHOW TABLES LIKE 'order_payments'`)
    const [kindColumn] = await runner.query(
      `SHOW COLUMNS FROM notifications LIKE 'kind'`,
    )
    await runner.release()
    check('schema stores the sewing rate snapshot', Boolean(rateColumn))
    check('schema stores receipts', Boolean(paymentsTable))
    check(
      'balance alerts fit the notification kind',
      String(kindColumn?.Type ?? '').includes('balance'),
      String(kindColumn?.Type ?? ''),
    )

    const stamp = Date.now().toString().slice(-8)
    const customer = await customers.create({
      name: `Review ${stamp}`,
      phone: `09${stamp}`.slice(0, 12),
    })
    customerId = customer.id
    const jellabeya = await products.create({
      name: `Review Jellabeya ${stamp}`,
      type: ProductType.CUSTOM,
      sewingPrice: 100,
    })
    const serwal = await products.create({
      name: `Review Serwal ${stamp}`,
      type: ProductType.CUSTOM,
      sewingPrice: 250,
    })
    const readyProduct = await products.create({
      name: `Review Ready ${stamp}`,
      type: ProductType.READY,
      sewingPrice: 0,
    })
    productIds.push(jellabeya.id, serwal.id, readyProduct.id)
    const shoulder = await products.addField(jellabeya.id, {
      fieldKey: 'shoulder',
      inputType: 'number',
      labels: [{ lang: 'en', label: 'Shoulder' }],
    })
    if (!shoulder) throw new Error('Shoulder field was not created')

    const fabric = await dataSource.getRepository(Fabric).save({
      name: `Review fabric ${stamp}`,
      qty: 100,
      sewingRatePerMeter: 999,
      sellingPricePerMeter: 50,
      packageMeters: 20,
      packagePrice: 1000,
    })
    fabricId = fabric.id
    const inventory = await dataSource.getRepository(InventoryItem).save({
      productId: readyProduct.id,
      qty: 10,
      price: 120,
      size: 'M',
    })
    inventoryId = inventory.id

    const custom = await orders.createCustom({
      customerId,
      items: [
        {
          productId: jellabeya.id,
          qty: 1,
          unitPrice: 1000,
          fabricId,
          fabricMeters: 4,
          measurements: [{ fieldId: shoulder.id, value: '44' }],
        },
        {
          productId: serwal.id,
          qty: 1,
          unitPrice: 800,
          fabricId,
          fabricMeters: 2,
          measurements: [],
        },
      ],
      total: 1800,
      paid: 300,
      paymentMethod: PaymentMethod.CASH,
      dueDate: dayOffset(3),
    })
    orderIds.push(custom.id)
    const customPayments = await dataSource.getRepository(OrderPayment).find({
      where: { orderId: custom.id },
    })
    check('custom checkout stores the deposit as a receipt', customPayments.length === 1 && Number(customPayments[0].amount) === 300)
    check(
      'custom balance stays in sync with the receipt',
      Number(custom.paid) === 300 && Number(custom.remaining) === Number(custom.total) - 300,
      `paid ${custom.paid} remaining ${custom.remaining} total ${custom.total}`,
    )
    let reduced = ''
    try {
      await orders.update(custom.id, { paid: 200 })
    } catch (error) {
      reduced = messageOf(error)
    }
    check('editing paid cannot reduce the amount', reduced === 'Paid amount cannot be reduced', reduced)
    const increased = await orders.update(custom.id, { paid: 400 })
    const customPaymentsAfterEdit = await dataSource.getRepository(OrderPayment).find({
      where: { orderId: custom.id },
    })
    const customReceiptTotal = customPaymentsAfterEdit.reduce((sum, row) => sum + Number(row.amount), 0)
    check(
      'increasing paid stores the difference as a receipt',
      customPaymentsAfterEdit.length === 2 && customReceiptTotal === 400 && Number(increased.paid) === 400,
      `receipts ${customReceiptTotal} paid ${increased.paid} count ${customPaymentsAfterEdit.length}`,
    )
    check(
      'the balance still matches the invoice minus receipts',
      Number(increased.total) - customReceiptTotal === Number(increased.remaining),
      `total ${increased.total} receipts ${customReceiptTotal} remaining ${increased.remaining}`,
    )

    const history = await customersController.getMeasurements(String(customerId))
    const jellabeyaHistory = history.flatMap((order) => order.items).find((item) => item.productId === jellabeya.id)
    check('measurement history includes the product id', jellabeyaHistory?.productId === jellabeya.id)
    check(
      'measurement history keeps the shoulder value',
      jellabeyaHistory?.measurements.some((row) => row.value === '44') === true,
    )

    let walkInRejected = ''
    try {
      await orders.createReady({
        items: [{ inventoryItemId: inventoryId, qty: 1, unitPrice: 120 }],
        total: 120,
        paid: 100,
        paymentMethod: PaymentMethod.CASH,
      })
    } catch (error) {
      walkInRejected = messageOf(error)
    }
    check(
      'a ready remainder cannot be a walk-in',
      walkInRejected === 'A registered customer is required',
      walkInRejected,
    )

    const walkIn = await orders.createReady({
      items: [{ inventoryItemId: inventoryId, qty: 1, unitPrice: 120 }],
      total: 120,
      paid: 120,
      paymentMethod: PaymentMethod.CASH,
    })
    orderIds.push(walkIn.id)
    check('a fully paid ready sale can stay a walk-in', walkIn.customerId == null)
    check(
      'ready checkout issues a receipt number',
      walkIn.receiptNumber === `REC-${walkIn.orderNumber}`,
      String(walkIn.receiptNumber),
    )

    const credit = await orders.createReady({
      items: [{ inventoryItemId: inventoryId, qty: 1, unitPrice: 120 }],
      total: 120,
      paid: 100,
      customerId,
      paymentMethod: PaymentMethod.MBOK,
      dueDate: dayOffset(0),
    })
    orderIds.push(credit.id)
    check('a ready remainder is attached to the customer', credit.customerId === customerId)
    check('ready remainder is the unpaid part', Number(credit.remaining) === 20, String(credit.remaining))

    const overdue = await orders.createReady({
      items: [{ inventoryItemId: inventoryId, qty: 1, unitPrice: 120 }],
      total: 120,
      paid: 20,
      customerId,
      paymentMethod: PaymentMethod.CASH,
      dueDate: dayOffset(-2),
    })
    const future = await orders.createReady({
      items: [{ inventoryItemId: inventoryId, qty: 1, unitPrice: 120 }],
      total: 120,
      paid: 20,
      customerId,
      paymentMethod: PaymentMethod.CASH,
      dueDate: dayOffset(4),
    })
    const undated = await orders.createReady({
      items: [{ inventoryItemId: inventoryId, qty: 1, unitPrice: 120 }],
      total: 120,
      paid: 20,
      customerId,
      paymentMethod: PaymentMethod.CASH,
    })
    orderIds.push(overdue.id, future.id, undated.id)

    const fabricSale = await orders.createFabricOrder({
      customerId,
      items: [{ fabricId, meters: 1, unitPrice: 50 }],
      paid: 10,
      paymentMethod: PaymentMethod.CASH,
      dueDate: dayOffset(1),
    })
    orderIds.push(fabricSale.id)
    check(
      'fabric checkout issues a receipt number',
      fabricSale.receiptNumber === `REC-${fabricSale.orderNumber}`,
      String(fabricSale.receiptNumber),
    )

    const anonNumber = `8${stamp}`.slice(0, 8)
    const anonymousOrder = new Order()
    anonymousOrder.orderNumber = anonNumber
    anonymousOrder.customerId = null
    anonymousOrder.type = OrderType.READY
    anonymousOrder.status = OrderStatus.DELIVERED
    anonymousOrder.total = 40
    anonymousOrder.paid = 10
    anonymousOrder.remaining = 30
    anonymousOrder.paymentMethod = PaymentMethod.CASH
    anonymousOrder.dueDate = dayOffset(-1)
    const anonymous = await dataSource.getRepository(Order).save(anonymousOrder)
    orderIds.push(anonymous.id)

    const open = await orders.receivables({ status: 'open' })
    const byId = new Map(open.rows.map((row) => [row.id, row]))
    check('today’s balance is due today', byId.get(credit.id)?.bucket === 'due_today', byId.get(credit.id)?.bucket)
    check('a future balance is not yet due', byId.get(future.id)?.bucket === 'not_yet_due', byId.get(future.id)?.bucket)
    check('a past balance is overdue', byId.get(overdue.id)?.bucket === 'overdue', byId.get(overdue.id)?.bucket)
    check('a balance with no due date is not yet due', byId.get(undated.id)?.bucket === 'not_yet_due', byId.get(undated.id)?.bucket)
    check('an anonymous balance needs a customer', byId.get(anonymous.id)?.needsCustomer === true)
    const aging = Object.fromEntries(open.aging.map((bucket) => [bucket.bucket, bucket.total]))
    check(
      'aging totals include these open balances',
      aging.due_today >= 20 && aging.not_yet_due >= 100 && aging.overdue >= 100,
      JSON.stringify(aging),
    )

    let overpaid = ''
    try {
      await orders.addReceipt(credit.id, { amount: 21, paymentMethod: PaymentMethod.CASH })
    } catch (error) {
      overpaid = messageOf(error)
    }
    check(
      'a receipt cannot exceed the balance',
      overpaid === 'Receipt amount exceeds the balance due',
      overpaid,
    )
    let anonReceipt = ''
    try {
      await orders.addReceipt(anonymous.id, { amount: 10, paymentMethod: PaymentMethod.CASH })
    } catch (error) {
      anonReceipt = messageOf(error)
    }
    check(
      'a receipt needs a customer on an anonymous balance',
      anonReceipt === 'A registered customer is required',
      anonReceipt,
    )
    const attached = await orders.attachCustomer(anonymous.id, customerId)
    check('an anonymous balance can be attached to a customer', attached.customerId === customerId)

    const settled = await orders.addReceipt(credit.id, {
      amount: 20,
      paymentMethod: PaymentMethod.CASH,
      paidAt: dayOffset(0),
    })
    const creditPayments = await dataSource.getRepository(OrderPayment).find({
      where: { orderId: credit.id },
    })
    const creditPaid = creditPayments.reduce((sum, row) => sum + Number(row.amount), 0)
    check('settling receipt reduces the balance to zero', Number(settled.remaining) === 0 && Number(settled.paid) === Number(settled.total))
    check(
      'balance equals the invoice total minus receipts',
      Number(settled.total) - creditPaid === Number(settled.remaining),
      `total ${settled.total} receipts ${creditPaid} remaining ${settled.remaining}`,
    )

    const period = await orders.receivables({
      from: dayOffset(0),
      to: dayOffset(0),
      status: 'settled',
    })
    check('collected in the period includes today’s receipts', period.stats.collected >= 20, String(period.stats.collected))
    check(
      'settled invoices can be listed on their own',
      period.rows.some((row) => row.id === credit.id && row.bucket === 'settled'),
    )

    await notifications.generateDueNotificationsForDate(new Date())
    const alerts = await dataSource.getRepository(Notification).find({
      where: { orderId: In([overdue.id, future.id, anonymous.id]), kind: 'balance' },
    })
    check(
      'an overdue balance is notified as overdue',
      alerts.some((row) => row.orderId === overdue.id && row.window === 'balance_overdue'),
    )
    check(
      'an open balance is notified before it is due',
      alerts.some((row) => row.orderId === future.id && row.window === 'balance_open'),
    )
    check(
      'an anonymous balance asks for a customer',
      alerts.some((row) => row.orderId === anonymous.id && row.window === 'balance_overdue'),
    )

    await workshop.deliver(custom.id)
    const delivered = await workshop.setItemReadiness(
      custom.items.find((item) => item.productId === jellabeya.id)!.id,
      true,
    )
    await workshop.setItemReadiness(
      delivered.items.find((item) => item.productId === serwal.id)!.id,
      true,
    )
    const readyItems = await dataSource
      .getRepository(Order)
      .findOne({ where: { id: custom.id }, relations: ['items'] })
    const jellabeyaItem = readyItems?.items.find((item) => item.productId === jellabeya.id)
    const serwalItem = readyItems?.items.find((item) => item.productId === serwal.id)
    check('marking ready snapshots the Jellabeya rate', Number(jellabeyaItem?.sewingRateApplied) === 100, String(jellabeyaItem?.sewingRateApplied))
    check('marking ready snapshots the Serwal rate', Number(serwalItem?.sewingRateApplied) === 250, String(serwalItem?.sewingRateApplied))
    check(
      'a fully ready custom order gets a receipt number',
      readyItems?.receiptNumber === `REC-${custom.orderNumber}`,
      String(readyItems?.receiptNumber),
    )

    await products.update(jellabeya.id, { sewingPrice: 500 })
    const payroll = await workshop.getPayroll()
    const jellabeyaPay = payroll.breakdown.find((row) => row.productId === jellabeya.id && row.rate === 100)
    const serwalPay = payroll.breakdown.find((row) => row.productId === serwal.id && row.rate === 250)
    check(
      'Jellabeya pay is 4 meters times the snapshotted rate',
      jellabeyaPay?.meters === 4 && jellabeyaPay.amount === 400,
      JSON.stringify(jellabeyaPay),
    )
    check(
      'Serwal pay uses its own rate on the same fabric',
      serwalPay?.meters === 2 && serwalPay.amount === 500,
      JSON.stringify(serwalPay),
    )
    check(
      'the fabric sewing rate is not the tailor rate',
      !payroll.breakdown.some((row) => row.productId === jellabeya.id && row.rate === 999),
    )
    check(
      'the pooled total includes both product amounts',
      payroll.total >= 900,
      String(payroll.total),
    )

    await workshop.setItemReadiness(jellabeyaItem!.id, false)
    const cleared = await dataSource
      .getRepository(Order)
      .findOne({ where: { id: custom.id }, relations: ['items'] })
    const clearedJellabeya = cleared?.items.find((item) => item.productId === jellabeya.id)
    const afterClear = await workshop.getPayroll()
    check('marking a piece not ready clears the snapshot', clearedJellabeya?.sewingRateApplied == null)
    check(
      'cleared meters leave the payroll',
      !afterClear.breakdown.some((row) => row.productId === jellabeya.id),
    )
  } finally {
    const notificationRepo = dataSource.getRepository(Notification)
    if (orderIds.length) {
      await notificationRepo.delete({ orderId: In(orderIds) })
      await dataSource.getRepository(OrderPayment).delete({ orderId: In(orderIds) })
    }
    for (const orderId of [...orderIds].reverse()) {
      try {
        await orders.remove(orderId)
      } catch (error) {
        console.error(`cleanup order ${orderId}: ${messageOf(error)}`)
      }
    }
    if (inventoryId) {
      await dataSource.getRepository(InventoryItem).delete({ id: inventoryId })
    }
    if (fabricId) {
      await dataSource.getRepository(FabricStockMovement).delete({ fabricId })
      await dataSource.getRepository(Fabric).delete({ id: fabricId })
    }
    for (const productId of productIds) {
      try {
        await products.remove(productId)
      } catch (error) {
        console.error(`cleanup product ${productId}: ${messageOf(error)}`)
      }
    }
    if (customerId) {
      await customers.remove(customerId)
    }
    await app.close()
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll pay, measurement, invoice, and debt checks passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
