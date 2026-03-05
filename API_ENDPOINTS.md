# API Endpoints Reference

## Base and Global Behavior

- Base URL: `http://localhost:3001/api`
- Global prefix: `/api` (all endpoints below are relative to this prefix, e.g. `POST /auth/login` means `POST /api/auth/login`)
- Content type: `application/json` for request bodies
- CORS: enabled (`origin: true`, `credentials: true`)
- Auth: JWT Bearer required on all endpoints except `POST /auth/login`
- Form-data: not used anywhere in this API (no multipart endpoints)

## Headers

- Public endpoints:
  - `Content-Type: application/json`
  - `Accept: application/json` (recommended)
- Protected endpoints:
  - `Authorization: Bearer <accessToken>`
  - `Content-Type: application/json`
  - `Accept: application/json` (recommended)

## Global Success Response Shape

Most successful responses are wrapped by a global interceptor:

```json
{
  "data": "...",
  "message": "success",
  "code": 200
}
```

Notes:
- For **non-paginated endpoints**, `data` is the resource documented in each section.
- For **paginated endpoints**, `data` is an object of the form:

  ```json
  {
    "data": [ /* items */ ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  }
  ```

## Global Error Response Shape

Errors are returned by a global exception filter:

```json
{
  "message": "Error message",
  "data": null,
  "code": 400
}
```

Common status codes:
- `400` validation errors / bad request
- `401` unauthorized / invalid credentials
- `404` entity not found
- `500` internal server error

Validation behavior (global `ValidationPipe`):
- unknown fields are rejected (`forbidNonWhitelisted: true`)
- unknown fields are stripped if allowed (`whitelist: true`)
- implicit type conversion is enabled for query params (`transform: true`)

---

## Auth

### `POST /auth/login`
- Auth: public
- Body:
  - `username` (string, required, non-empty)
  - `password` (string, required, min length 1)
- Success (`200`):
  - `data.accessToken` (JWT, expires in 30 days)
  - `data.user`: `{ id, username, role }`
- Errors:
  - `400` invalid body
  - `401` `"Invalid credentials"`

### `GET /auth/me`
- Auth: required
- Body: none
- Query: none
- Success (`200`):
  - `data`: user profile from DB: `{ id, username, roleId, createdAt, role }`
- Errors:
  - `401` invalid/missing token

---

## Users

### `PATCH /users/:id/password`
- Auth: required
- Params:
  - `id` (number path param)
- Body:
  - `password` (string, required, min length 6)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `400` validation/parsing errors
  - `401` unauthorized

---

## Customers

### `GET /customers`
- Auth: required
- Query:
  - `page?` (int >= 1, default `1`)
  - `limit?` (int 1..100, default `20`)
  - `search?` (string; matches `name` or `phone` using SQL LIKE)
  - `phone?` (string exact match)
- Success (`200`):
  - `data.data`: array of customers with:
    - `id: number`
    - `name: string`
    - `phone: string`
    - `notes?: string | null`
    - `createdAt?: string`
    - `ordersCount: number`
    - `totalSpent: number`
    - `lastOrderDate?: string | null` (ISO `YYYY-MM-DD`)
  - `data.meta`: `{ page, limit, total }`

### `GET /customers/list`
- Auth: required
- Query: none
- Success (`200`):
  - `data`: array of customers, each with:
    - `id: number`
    - `name: string`
    - `phone: string`

### `POST /customers`
- Auth: required
- Body:
  - `name` (string, required, max 255)
  - `phone` (string, required, max 50)
  - `notes?` (string)
- Success (`201`):
  - `data`: created customer
- Errors:
  - `400` validation

### `GET /customers/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data`: customer with:
    - base fields: `id`, `name`, `phone`, `notes`, `createdAt`
    - aggregates: `ordersCount`, `totalSpent`, `lastOrderDate`
    - `orders`: full orders list for that customer
- Errors:
  - `404` `"Customer not found"`

### `PATCH /customers/:id`
- Auth: required
- Params: `id` (number)
- Body: partial of create DTO (`name`, `phone`, `notes`)
- Success (`200`):
  - `data`: updated customer (same as `GET /customers/:id`)
- Errors:
  - `404` if customer missing after update lookup

### `GET /customers/:id/measurements`
- Auth: required
- Params: `id` (number, customer id)
- Query: none
- Success (`200`):
  - `data`: array of orders for this customer. Each order includes:
    - `id: number` (order id)
    - `createdAt: string` (ISO datetime)
    - `items`: array of:
      - `productName: string | null`
      - `measurements`: array of:
        - `id: number`
        - `fieldId: number`
        - `value: string`
        - `field?: {`
          - `id: number`
          - `fieldKey: string`
          - `inputType: string`
          - `required: boolean`
          - `i18n?: { lang: 'en' | 'ar' | 'bn'; label: string }[]`
        - `}`
- Errors:
  - none specific beyond auth; if customer has no orders, `data` is an empty array

### `DELETE /customers/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Customer not found"`

---

## Products

Enums:
- `type`: `custom | ready`

### `GET /products`
- Auth: required
- Query:
  - `type?` (`custom|ready`)
- Success (`200`):
  - `data`: product array. Each product includes:
    - `id: number`
    - `name: string`
    - `type: 'custom' | 'ready'`
    - `basePrice: number`
    - `createdAt: string`
    - `fields?: {`
      - `id: number`
      - `fieldKey: string`
      - `inputType: string`
      - `required: boolean`
      - `i18n?: { lang: 'en' | 'ar' | 'bn'; label: string }[]`
    - `}[]`

### `GET /products/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data`: single product with the same shape as items from `GET /products`
- Errors:
  - `404` `"Product not found"`

### `POST /products`
- Auth: required
- Body:
  - `name` (string, required, max 255)
  - `type` (`custom|ready`, required)
  - `basePrice?` (number)
- Success (`201`):
  - `data`: created product
- Errors:
  - `400` validation

### `PATCH /products/:id`
- Auth: required
- Params: `id` (number)
- Body: partial of `POST /products` body
- Success (`200`):
  - `data`: updated product
- Errors:
  - `404` `"Product not found"`

### `DELETE /products/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Product not found"`

### `GET /products/:id/fields`
- Auth: required
- Params: `id` (product id)
- Success (`200`):
  - `data`: product field array with `i18n`, sorted by `sortOrder, id`
- Errors:
  - `404` if product missing

### `POST /products/:id/fields`
- Auth: required
- Params: `id` (product id)
- Body:
  - `fieldKey` (string, required)
  - `inputType` (string, required)
  - `required?` (boolean)
  - `labels?` (array of `{ lang: "en"|"ar"|"bn", label: string }`)
- Success (`201`):
  - `data`: created field:
    - `id: number`
    - `fieldKey: string`
    - `inputType: string`
    - `required: boolean`
    - `i18n?: { lang: 'en' | 'ar' | 'bn'; label: string }[]`
- Errors:
  - `400` validation
  - `404` if product missing

### `PATCH /products/fields/:fieldId`
- Auth: required
- Params: `fieldId` (number)
- Body: partial of field body above
- Success (`200`):
  - `data`: updated field with the same shape as `POST /products/:id/fields`
- Errors:
  - `404` `"Field not found"`

### `DELETE /products/fields/:fieldId`
- Auth: required
- Params: `fieldId` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Field not found"`

---

## Orders

Enums:
- `type`: `custom | ready`
- `status`: `pending | in_progress | ready | delivered | cancelled`
- `paymentMethod`: `cash | mbok`

### `POST /orders/custom`
- Auth: required
- Body:
  - `customerId` (number, required)
  - `items` (array, required) where each item has:
    - `productId` (number, required)
    - `qty` (number, required, min 1)
    - `unitPrice` (number, required)
    - `measurements` (array, required) of:
      - `fieldId` (number, required)
      - `value` (string, required)
  - `total` (number, required)
  - `paid` (number, required)
  - `paymentMethod?` (`cash|mbok`)
  - `dueDate?` (ISO date string)
  - `noteCustomer?` (string)
  - `noteWorkshop?` (string)
- Success (`201`):
  - `data`: full created order (same shape as `GET /orders/:id`)
- Errors:
  - `400` validation

### `POST /orders/ready`
- Auth: required
- Body:
  - `items` (array, required) where each item has:
    - `inventoryItemId` (number, required)
    - `qty` (number, required, min 1)
    - `unitPrice` (number, required)
  - `total` (number, required)
  - `paid` (number, required)
  - `paymentMethod?` (`cash|mbok`)
  - `dueDate?` (ISO date string)
- Success (`201`):
  - `data`: full created order
- Errors:
  - `400` validation
  - `404` if referenced inventory item is missing

### `GET /orders`
- Auth: required
- Query:
  - `page?` (int >= 1, default `1`)
  - `limit?` (int 1..100, default `20`)
  - `type?` (`custom|ready`)
  - `status?` (`pending|in_progress|ready|delivered|cancelled`)
  - `from?` (string; used against `created_at >= from`)
  - `to?` (string; used against `created_at <= to`)
- Success (`200`):
  - `data.data`: order array. Each order includes:
    - `id: number`
    - `type: 'custom' | 'ready'`
    - `status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled'`
    - `paymentMethod?: 'cash' | 'mbok' | null`
    - `total: number`
    - `paid: number`
    - `remaining: number`
    - `dueDate?: string | null` (ISO date)
    - `noteCustomer?: string | null`
    - `noteWorkshop?: string | null`
    - `createdAt?: string | null` (ISO date)
    - `customer?: { id: number; name: string; phone?: string | null } | null`
    - `items: {`
      - `id: number`
      - `productId: number`
      - `qty: number`
      - `unitPrice: number`
      - `subtotal: number`
      - `product?: { id: number; name: string }`
    - `}[]`
  - `data.meta`: `{ page, limit, total }`

### `GET /orders/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data`: single order with:
    - the same base fields as in `GET /orders`
    - `items: {`
      - `id: number`
      - `productId: number`
      - `qty: number`
      - `unitPrice: number`
      - `subtotal: number`
      - `product?: { id: number; name: string }`
      - `measurements?: {`
        - `id: number`
        - `fieldId: number`
        - `value: string`
        - `field?: {`
          - `id: number`
          - `fieldKey: string`
          - `inputType: string`
          - `required: boolean`
          - `i18n?: { lang: 'en' | 'ar' | 'bn'; label: string }[]`
        - `}`
      - `}[]`
    - `}[]`
- Errors:
  - `404` `"Order not found"`

### `PATCH /orders/:id`
- Auth: required
- Params: `id` (number)
- Body:
  - accepted fields:
    - `status?: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled'`
    - `paid?: number`
    - `dueDate?: string` (ISO date)
    - `paymentMethod?: 'cash' | 'mbok'`
  - no DTO/class-validator rules are applied; payload is passed directly to the update
- Success (`200`):
  - `data`: updated order with the same shape as `GET /orders/:id`
- Errors:
  - `404` `"Order not found"`

### `DELETE /orders/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Order not found"`

---

## Inventory

### `GET /inventory/items`
- Auth: required
- Query:
  - `page?` (int >= 1, default `1`)
  - `limit?` (int 1..100 from global DTO; service fallback default is `50`)
- Success (`200`):
  - `data.data`: inventory item array. Each item includes:
    - `id: number`
    - `product: { id: number; name: string }`
    - `size?: string | null`
    - `qty: number`
    - `price: number`
  - `data.meta`: `{ page, limit, total }`

### `POST /inventory/items`
- Auth: required
- Body:
  - `productId` (number, required)
  - `size?` (string)
  - `qty` (number, required, min 0)
  - `price` (number, required, min 0)
- Success (`201`):
  - `data`: created inventory item
- Errors:
  - `400` validation

### `PATCH /inventory/items/:id`
- Auth: required
- Params: `id` (number)
- Body: partial of create inventory item DTO
- Success (`200`):
  - `data`: updated inventory item with `product`
- Errors:
  - `404` `"Inventory item not found"`

### `DELETE /inventory/items/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Inventory item not found"`

### `GET /inventory/fabrics`
- Auth: required
- Query:
  - `page?` (int >= 1, default `1`)
  - `limit?` (int 1..100; service fallback default `50`)
- Success (`200`):
  - `data.data`: fabrics array. Each fabric includes:
    - `id: number`
    - `name: string`
    - `unit: string` (e.g. `"meter"`)
    - `qty: number`
    - `costPerUnit: number`
  - `data.meta`: `{ page, limit, total }`

### `POST /inventory/fabrics`
- Auth: required
- Body:
  - `name` (string, required)
  - `unit?` (string)
  - `qty` (number, required, min 0)
  - `costPerUnit` (number, required, min 0)
- Success (`201`):
  - `data`: created fabric
- Errors:
  - `400` validation

### `PATCH /inventory/fabrics/:id`
- Auth: required
- Params: `id` (number)
- Body: partial of create fabric DTO
- Success (`200`):
  - `data`: updated fabric
- Errors:
  - `404` `"Fabric not found"`

### `DELETE /inventory/fabrics/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Fabric not found"`

---

## Expenses

### `GET /expenses/types`
- Auth: required
- Query: none
- Success (`200`):
  - `data`: expense type array sorted by name. Each type includes:
    - `id: number`
    - `name: string`
    - `isCustom: boolean`

### `POST /expenses/types`
- Auth: required
- Body:
  - `name` (string, required)
  - `isCustom?` (boolean; defaults to `true`)
- Success (`201`):
  - `data`: created expense type
- Errors:
  - `400` validation

### `GET /expenses`
- Auth: required
- Query:
  - `page?` (int >= 1, default `1`)
  - `limit?` (int 1..100, default `20`)
  - `from?` (date string)
  - `to?` (date string)
  - `type?` (expense type id)
- Success (`200`):
  - `data.data`: expenses array. Each expense includes:
    - `id: number`
    - `type: { id: number; name: string; isCustom: boolean }`
    - `amount: number`
    - `date: string` (ISO `YYYY-MM-DD`)
    - `note?: string | null`
  - `data.meta`: `{ page, limit, total }`

### `GET /expenses/summary`
- Auth: required
- Query:
  - `period?`: `today | month | year` (default `today`)
- Success (`200`):
  - `data`: `{ total: number|string }` (DB aggregate may come as string depending on driver)

### `POST /expenses`
- Auth: required
- Body:
  - `typeId` (number, required)
  - `amount` (number, required, min 0)
  - `date` (ISO date string, required)
  - `note?` (string)
- Success (`201`):
  - `data`: created expense
- Errors:
  - `400` validation

### `GET /expenses/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data`: single expense with the same shape as items from `GET /expenses`
- Errors:
  - `404` `"Expense not found"`

### `PATCH /expenses/:id`
- Auth: required
- Params: `id` (number)
- Body: partial of create expense DTO
- Success (`200`):
  - `data`: updated expense
- Errors:
  - `404` `"Expense not found"`

### `DELETE /expenses/:id`
- Auth: required
- Params: `id` (number)
- Success (`200`):
  - `data: { ok: true }`
- Errors:
  - `404` `"Expense not found"`

---

## Dashboard

### `GET /dashboard/stats`
- Auth: required
- Query: none
- Success (`200`):
  - `data`:
    - `totalOrders` (number)
    - `totalRevenue` (number)
    - `activeCustomers` (number)
    - `workingDays` (number, currently static placeholder `22`)

### `GET /dashboard/sales-chart`
- Auth: required
- Query:
  - `year?` (number; default current year)
  - `compareYear?` (number)
- Success (`200`):
  - `data`:
    - `year` (number)
    - `compareYear` (number|null)
    - `data`: array of 12 objects `{ month, total, compare }`

### `GET /dashboard/top-products`
- Auth: required
- Query:
  - `limit?` (number; default `10`)
- Success (`200`):
  - `data`: array of `{ productId, name, qty, total }`

### `GET /dashboard/top-customers`
- Auth: required
- Query:
  - `limit?` (number; default `20`)
- Success (`200`):
  - `data`: array of:
    - `customerId: number`
    - `name: string`
    - `phone?: string | null`
    - `ordersCount: number`
    - `totalSpent: number`

---

## Settings

### `GET /settings`
- Auth: required
- Query: none
- Success (`200`):
  - `data`: flat key/value object of app settings. It always includes at least:
    - `workshopName: string`
    - `workshopPhone: string`
    - `workshopAddress: string`
    - `logoUrl: string`
    - `language: string` (e.g. `'en' | 'ar' | 'bn'`)
    - `currency: string` (e.g. `'SDG' | 'USD'`)
    - `dateFormat: string` (e.g. `'YYYY-MM-DD'`, `'DD/MM/YYYY'`)
    - `printer: string`
    - `showOrderSubmitConfirm: boolean`
    - `adminName: string`
    - `adminUsername: string`

### `PATCH /settings`
- Auth: required
- Body:
  - arbitrary JSON object of keys to update:
    - `{ "key1": "value", "key2": { "nested": true }, ... }`
- Success (`200`):
  - `data`: full settings object after applying updates
- Errors:
  - `400` when body is not a valid object payload

---

## Notifications

### `GET /notifications`
- Auth: required
- Query:
  - `limit?` (number; default `20`)
- Success (`200`):
  - `data`: array of notifications, ordered by `createdAt` desc. Each notification includes:
    - `id: number`
    - `title: string`
    - `subtitle?: string | null`
    - `kind: 'due' | 'stock'`
    - `orderId?: number | null`
    - `inventoryItemId?: number | null`
    - `window?: string | null` (for due-date window: `'due_in_2' | 'due_tomorrow' | 'due_today'`)
    - `isRead: boolean`
    - `createdAt: string` (ISO)

### `PATCH /notifications/:id/read`
- Auth: required
- Params:
  - `id` (number)
- Body: none
- Success (`200`):
  - `data: { ok: true }`

### `PATCH /notifications/mark-all-read`
- Auth: required
- Body: none
- Success (`200`):
  - `data: { ok: true }`

---

## Quick Notes

- Decimal fields from MySQL may be serialized as strings by TypeORM depending on driver behavior.
- `PATCH /orders/:id` currently has no DTO/class-validator rules; malformed fields may pass through to DB update logic.
- No endpoint currently supports multipart upload or file input.
