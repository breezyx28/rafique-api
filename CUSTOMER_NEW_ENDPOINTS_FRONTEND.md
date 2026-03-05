# Customer Endpoints: Minimal List & Measurements

This document explains the **two new customer endpoints** for the frontend.

All paths are relative to `http://localhost:3001/api` and use the global response envelope:

```json
{
  "data": ...,
  "message": "success",
  "code": 200
}
```

---

## 1. Minimal customers list

### `GET /customers/list`

- **Auth**: required (Bearer JWT)
- **Query**: none
- **Purpose**: Get a lightweight list of **all customers** for dropdowns/autocomplete.

**Success response:**

```json
{
  "data": [
    { "id": 1, "name": "Customer A", "phone": "0912..." },
    { "id": 2, "name": "Customer B", "phone": "0999..." }
  ],
  "message": "success",
  "code": 200
}
```

- **Item shape**:
  - `id: number`
  - `name: string`
  - `phone: string`
- **Notes**:
  - No pagination: returns all rows.
  - Ordered by `name` (ASC), then `id` (ASC).
  - No aggregates (`ordersCount`, `totalSpent`, etc.).

**Frontend usage:**
- Use as the source for customer pickers (selects, autocompletes).
- Recommended type:

```ts
type CustomerMinimal = {
  id: number;
  name: string;
  phone: string;
};
```

---

## 2. Customer measurements by order

### `GET /customers/:id/measurements`

- **Auth**: required (Bearer JWT)
- **Params**:
  - `id` — customer id (number)
- **Query**: none
- **Purpose**: Fetch **all orders** for a customer, including products and all measurements per order item.

**Success response (example, truncated):**

```json
{
  "data": [
    {
      "id": 123,
      "createdAt": "2026-03-04T12:00:00.000Z",
      "items": [
        {
          "productName": "Jelabeya",
          "measurements": [
            {
              "id": 100,
              "fieldId": 20,
              "value": "140",
              "field": {
                "id": 20,
                "fieldKey": "height",
                "inputType": "text",
                "required": true,
                "i18n": [
                  { "lang": "en", "label": "Height" },
                  { "lang": "ar", "label": "الطول" }
                ]
              }
            }
          ]
        }
      ]
    }
  ],
  "message": "success",
  "code": 200
}
```

**Data shape:**

- `data` is an **array of orders** for the given customer.
- Each order is minimized to focus on **id, createdAt, product name, and measurements**:
  - `id: number` (order id)
  - `createdAt: string` (ISO datetime)
  - `items[]`:
    - `productName: string | null`
    - `measurements[]`:
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

- If the customer has **no orders**, `data` is an **empty array**.

**Frontend usage:**

- To show a **measurement history** per customer:
  - Group orders by date, then within each order show product + measurements.
- To derive latest measurements for a given product/field:
  - Filter `data` by product, sort by `createdAt`, and pick the latest `measurements` entries.

Recommended TypeScript type:

```ts
type CustomerMeasurementOrder = {
  id: number;
  createdAt: string;
  items: Array<{
    productName: string | null;
    measurements: Array<{
      id: number;
      fieldId: number;
      value: string;
      field?: {
        id: number;
        fieldKey: string;
        inputType: string;
        required: boolean;
        i18n?: Array<{ lang: 'en' | 'ar' | 'bn'; label: string }>;
      };
    }>;
  }>;
};
```

