# API Updates for Frontend

This document summarizes recent API changes so the frontend can align requests, response handling, and types.

---

## 1. Base URL and prefix

- **All endpoints are under the `/api` prefix.**
- Base URL: `http://localhost:3001/api` (or your deployed host + `/api`).
- Examples:
  - Login: `POST /api/auth/login`
  - Customers list: `GET /api/customers`
  - Notifications: `GET /api/notifications`

**Frontend:** Set the API base URL / axios baseURL to include `/api`. Do not use `http://localhost:3001` alone for API calls.

---

## 2. Response envelope (all responses)

Every response uses the same envelope.

**Success (2xx):**

```json
{
  "data": <resource or array or { data, meta }>,
  "message": "success",
  "code": 200
}
```

**Error (4xx / 5xx):**

```json
{
  "data": null,
  "message": "Error message string",
  "code": 400
}
```

- **Frontend:** Parse the **payload** from `response.data` (or your HTTP client’s body). The actual result is in `data`; `message` and `code` are always present. For errors, use `message` and `code` (no longer `error: true` or `statusCode`).

---

## 3. Paginated list responses

For list endpoints (e.g. `GET /api/customers`, `GET /api/orders`, `GET /api/expenses`), the envelope’s `data` is an object with `data` and `meta`:

```json
{
  "data": {
    "data": [ /* array of items */ ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  },
  "message": "success",
  "code": 200
}
```

- **Frontend:** Use `response.data.data.data` for the list and `response.data.data.meta` for pagination (page, limit, total). Do not assume the list is at `response.data.data` only; for list endpoints it’s `response.data.data.data`.

---

## 4. Pagination query params

- **`limit`** has a **maximum of 100** for all paginated endpoints.
- Sending `limit=200` (or any value &gt; 100) returns **400** with message like `"limit must not be greater than 100"`.

**Frontend:** Cap `limit` at 100. To show more than 100 items, use multiple pages (e.g. `page=1&limit=100`, `page=2&limit=100`).

---

## 5. Customers: `whatsapp` removed, `phone` required

**Breaking changes:**

- **`whatsapp`** has been removed from the API and database. Do not send or display it.
- **`phone`** is **required** when creating a customer.

**Create customer `POST /api/customers` body:**

- **Before:** `name`, optional `phone`, optional `whatsapp`, optional `notes`.
- **Now:** `name` (required), **`phone` (required)**, optional `notes`.

Example:

```json
{
  "name": "Customer Name",
  "phone": "0912345678",
  "notes": "Optional notes"
}
```

**List and detail responses:** Customer objects now have `id`, `name`, `phone`, `notes`, `createdAt`, and (on list) `ordersCount`, `totalSpent`, `lastOrderDate`. There is no `whatsapp` field.

**Frontend:** Remove all references to `whatsapp`. Require `phone` in create-customer form and in types/interfaces. Update customer list/detail types to drop `whatsapp`.

---

## 6. Product custom fields: label language key

For **`POST /api/products/:id/fields`** and **`PATCH /api/products/fields/:fieldId`**, each item in **`labels`** can use either:

- **`lang`** (e.g. `"en"`, `"ar"`, `"bn"`), or  
- **`language`** (same values).

Both are accepted. The API normalizes to `lang` internally.

Example (both valid):

```json
{ "lang": "en", "label": "Height" }
{ "language": "en", "label": "Height" }
```

**Frontend:** You can keep sending `language` if you already do; no change required. If you prefer to align with the API docs, you can switch to `lang`.

---

## 7. Notifications (new)

New endpoints for the header notifications dropdown:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications?limit=20` | List notifications (default limit 20). |
| PATCH | `/api/notifications/:id/read` | Mark one as read. |
| PATCH | `/api/notifications/mark-all-read` | Mark all as read. |

All require **Authorization: Bearer &lt;token&gt;**.

**Response list item shape:**

- `id: number`
- `title: string`
- `subtitle: string | null`
- `kind: 'due' | 'stock'`
- `orderId: number | null`
- `inventoryItemId: number | null`
- `window: string | null` (e.g. `due_in_2`, `due_tomorrow`, `due_today` for due notifications)
- `isRead: boolean`
- `createdAt: string` (ISO)

**Frontend:** Point the notifications feature to these endpoints and use the envelope: list is in `response.data.data` (array). Mark read endpoints return `data: { ok: true }`.

---

## 8. Customers list: `search` and `phone` query params

- **`GET /api/customers`** supports optional query params: **`search`** and **`phone`** (in addition to `page` and `limit`).
- If the backend validation expects only whitelisted params, sending **empty** params (e.g. `search=`) can result in **400** (e.g. “property search should not exist” or similar).

**Frontend:** When building the URL for the customers list, **omit** `search` or `phone` when they are empty. Example: use `?page=1&limit=100` when there is no search term; add `&search=...` or `&phone=...` only when they have a value.

---

## 9. Settings: default keys

**`GET /api/settings`** always returns an object that includes at least these keys (with default values if not set in DB):

- `workshopName`, `workshopPhone`, `workshopAddress`, `logoUrl`
- `language`, `currency`, `dateFormat`, `printer`, `showOrderSubmitConfirm`
- `adminName`, `adminUsername`

**Frontend:** You can assume these keys exist on the settings object; use defaults in UI when the value is empty.

---

## Quick checklist for frontend

- [ ] Base URL includes `/api`.
- [ ] All responses parsed from envelope: success data in `data`, errors use `data: null`, `message`, `code`.
- [ ] Paginated lists: items in `data.data`, pagination in `data.meta` (page, limit, total).
- [ ] Pagination `limit` ≤ 100.
- [ ] Customers: no `whatsapp`; `phone` required on create; types updated.
- [ ] Product field labels: can send either `lang` or `language` per label.
- [ ] Notifications: use new endpoints under `/api/notifications` and envelope.
- [ ] Customers list: omit empty `search` / `phone` query params.

For full request/response details, see **API_ENDPOINTS.md** in this repo.
