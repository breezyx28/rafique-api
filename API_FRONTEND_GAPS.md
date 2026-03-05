# API vs Frontend Data Gaps

This file tracks current mismatches/limitations found while connecting frontend pages to real endpoints with RTK Query + Zod.

## Confirmed Gaps (with required frontend field names)

### 1. Customers: profile & aggregates

**Endpoints involved**
- `GET /customers`
- `GET /customers/:id`
- `POST /customers`
- `PATCH /customers/:id`

**Frontend needs**

- Customer base fields (list + detail):
  - `id: number`
  - `name: string`
  - `phone: string` (required)
  - `notes?: string | null`
  - `createdAt?: string` (ISO, used as fallback for last order date)

- Aggregates for customers table (`CustomersPage.tsx`):
  - `ordersCount: number`  
    - total number of orders for this customer.
  - `totalSpent: number`  
    - sum of all paid amounts (or totals) for this customer.
  - `lastOrderDate?: string` (ISO `YYYY-MM-DD`)  
    - date of the latest order; used for the "Last Order Date" column.

These three can be:
- either real columns on the customer entity returned by `GET /customers`
- or computed in the query and added to the DTO.

**Optional, nice-to-have for future (was used in early frontend)**

- Customer-level saved measurements:
  - `measurements?: { label: string; value: string }[]`
  - This would allow persisting generic customer measurements outside of a specific order.

### 2. Dashboard: customers & products

**Endpoints**
- `GET /dashboard/stats`
- `GET /dashboard/sales-chart`
- `GET /dashboard/top-products`
- `GET /dashboard/top-customers`

**Frontend needs**

- `/dashboard/stats` must return (already documented, but required by UI):
  - `totalOrders: number`
  - `totalRevenue: number`
  - `activeCustomers: number`
  - `workingDays: number`

- `/dashboard/sales-chart`:
  - `year: number`
  - `compareYear: number | null`
  - `data: { month: number; total: number; compare: number | null }[]`

- `/dashboard/top-products`:
  - `productId: number`
  - `name: string`
  - `qty: number`
  - `total: number`

- `/dashboard/top-customers`:
  - `customerId: number`
  - `name: string`
  - `phone: string`
  - `ordersCount: number`
  - `totalSpent: number`

These shapes already mostly exist in `API_ENDPOINTS.md`; the key requirement from frontend is that they are **always present and typed exactly like this**.

### 3. Settings: required keys under `/settings`

**Endpoints**
- `GET /settings`
- `PATCH /settings`

**Frontend needs**

The settings object should at least include these keys:

- General (shop info):
  - `workshopName: string`
  - `workshopPhone?: string`
  - `workshopAddress?: string`
  - `logoUrl?: string` (for logo upload result; see file section below)

- Preferences:
  - `language: string`  
    - example values: `'en' | 'ar' | 'bn'`
  - `currency: string`  
    - example values: `'SDG' | 'USD'`
  - `dateFormat?: string`  
    - example values: `'YYYY-MM-DD'`, `'DD/MM/YYYY'`
  - `printer?: string`  
    - printer name/model text
  - `showOrderSubmitConfirm?: boolean`  
    - controls "show confirmation dialog before order submit" toggle.

- Users (settings "Users & Roles" table header row):
  - `adminName?: string`  
  - `adminUsername?: string`

The frontend calls:
- `GET /settings` and expects a flat object containing at least the keys above.
- `PATCH /settings` can be called with a partial object, for example:
  - `{ "workshopName": "Rafique Tailors" }`
  - `{ "currency": "SDG", "language": "ar" }`

### 4. File / backup behavior implied by UI

**UI components**
- Shop logo upload (`Logo` input in Settings → General).
- Backup export/import cards (Settings → Backup).

**Frontend needs**

There are **no concrete endpoints today**, but based on the current UI, backend should provide:

- Either:
  - A file upload endpoint for logo:
    - `POST /files/logo` → `data: { url: string }`
    - Then frontend writes `logoUrl` into `/settings`.
  - Or extend `/settings` PATCH to accept a `logoUrl` string that is generated server-side.

- For backup:
  - A download endpoint for exporting backup:
    - e.g. `GET /backup/export` → returns a downloadable file.
  - An upload endpoint for restoring backup:
    - e.g. `POST /backup/import` with a backup file in the body.

Field-wise, the only mandatory setting key for the current UI is:
- `logoUrl: string` (displaying the current logo if you want to wire that fully).

### 5. Orders: update + list fields

**Endpoints**
- `GET /orders`
- `GET /orders/:id`
- `PATCH /orders/:id`
- `POST /orders/custom`
- `POST /orders/ready`

**Frontend needs in order DTO**

For list and invoice views, each order should include:

- Base fields:
  - `id: number`
  - `type: 'custom' | 'ready'`
  - `status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled'`
  - `paymentMethod?: 'cash' | 'mbok' | null`
  - `total: number`
  - `paid: number`
  - `dueDate?: string | null` (ISO date)
  - `createdAt?: string | null` (ISO date)

- Relations:
  - `customer?: { id: number; name: string; phone?: string | null }`
  - `items: {`
    - `id: number`
    - `productId: number`
    - `qty: number`
    - `unitPrice: number`
    - `product?: { id: number; name: string }`
    - `measurements?: {`
      - `fieldId: number`
      - `value: string`
      - `field?: { id: number; fieldKey: string }`
    - `}[]`
  - `}[]`

- Notes used by invoice views:
  - `noteCustomer?: string | null`
  - `noteWorkshop?: string | null`

**Update endpoint (`PATCH /orders/:id`)**

Frontend edit modal currently updates:
- `status?: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled'`
- `paid?: number`

For full flexibility (and to match earlier UI behavior) it would be helpful if backend also allowed:
- `dueDate?: string` (ISO)
- `paymentMethod?: 'cash' | 'mbok'`

### 6. Inventory pages: ready items & fabrics

**Endpoints**
- `GET /inventory/items`
- `PATCH /inventory/items/:id`
- `DELETE /inventory/items/:id`
- `GET /inventory/fabrics`
- `PATCH /inventory/fabrics/:id`
- `DELETE /inventory/fabrics/:id`

**Frontend needs**

For `GET /inventory/items` list:
- `id: number`
- `product: { id: number; name: string }`
- `size?: string | null`
- `qty: number`
- `price: number`

For `GET /inventory/fabrics` list:
- `id: number`
- `name: string`
- `unit?: string | null`
- `qty: number`
- `costPerUnit: number`

Update bodies should accept the same field names (`size`, `qty`, `price`, `name`, `unit`, `costPerUnit`).

### 7. Expenses: types, list & summary

**Endpoints**
- `GET /expenses/types`
- `POST /expenses/types`
- `GET /expenses`
- `GET /expenses/summary`
- `POST /expenses`

**Frontend needs**

Expense type:
- `id: number`
- `name: string`
- `isCustom?: boolean`

Expense row:
- `id: number`
- `type: { id: number; name: string; isCustom?: boolean }`
- `amount: number`
- `date: string` (ISO `YYYY-MM-DD`)
- `note?: string | null`

Summary:
- `GET /expenses/summary` response:
  - `data: { total: number | string }`  
    (frontend already coerces to number).

### 8. Products & measurements config

**Endpoints**
- `GET /products?type=custom`
- `GET /products/:id/fields`
- `POST /products`
- `POST /products/:id/fields`
- `PATCH /products/fields/:fieldId`
- `DELETE /products/fields/:fieldId`

**Frontend needs**

Product:
- `id: number`
- `name: string`
- `type: 'custom' | 'ready'`

Field (measurement config):
- `id: number`
- `fieldKey: string`
- `inputType: string` (frontend uses `'text' | 'number' | 'select'` in UI)
- `required?: boolean`
- `i18n?: { lang: 'en' | 'ar' | 'bn'; label: string }[]`

When updating a field from the UI, the body sent to the API is:
- `{ fieldKey?: string; inputType?: string; required?: boolean; labels?: { lang: 'en' | 'ar' | 'bn'; label: string }[] }`

### 9. `/orders/new` wizard assumptions (remaining work)

**Endpoints to rely on**
- `GET /customers?phone=...` (customer lookup by phone)
- `POST /customers` (create customer if not found)
- `GET /products?type=custom`
- `GET /products/:id/fields`
- `POST /orders/custom`

**Frontend needs for API alignment (fields)**

- Customers:
  - Must be searchable by `phone` (`GET /customers?phone=0912...`).

- Products:
  - Custom products must be tagged with `type: 'custom'`.

- Fields:
  - Measurement fields per product must include:
    - `id`
    - `fieldKey`
    - `inputType`
    - `required`
    - `i18n` with `lang` + `label` (so labels can be shown in EN/AR/BN).

- Custom order creation:
  - `POST /orders/custom` body already matches what frontend will send:
    - `customerId: number`
    - `items: { productId: number; qty: number; unitPrice: number; measurements: { fieldId: number; value: string }[] }[]`
    - `total: number`
    - `paid: number`
    - `paymentMethod?: 'cash' | 'mbok'`
    - `dueDate?: string`
    - `noteCustomer?: string`
    - `noteWorkshop?: string`

No extra fields are required beyond what is listed above; the main work is wiring the wizard to call these endpoints.

## Recommendation

Use this file as the canonical handoff for follow-up agent work:
- Finish full API-native custom-order wizard (`/orders/new`)
- Add server-backed user/roles and backup endpoints (or adjust UI scope)
- Introduce dedicated aggregate customer endpoint if dashboard merge is not desired
