# Customer model update: WhatsApp removed, phone required

Summary of changes to the **Customer** resource for frontend integration.

---

## What changed

| Item | Before | After |
|------|--------|--------|
| **whatsapp** | Optional field on customer | **Removed** from API and database. Do not send or use. |
| **phone** | Optional | **Required** when creating a customer. |

---

## API impact

### Create customer — `POST /api/customers`

**Request body**

- **Remove:** `whatsapp`
- **Require:** `phone` (must be sent and non-empty)

**Valid body example:**

```json
{
  "name": "Customer Name",
  "phone": "0912345678",
  "notes": "Optional notes"
}
```

**Invalid:** Missing `phone` or sending `whatsapp` (validation error).

---

### Update customer — `PATCH /api/customers/:id`

- **Remove:** Any `whatsapp` field from the request body.
- **Optional:** `phone` can be included to change the customer’s phone.

---

### List customers — `GET /api/customers`

**Each customer in the response** has:

- `id`, `name`, **`phone`**, `notes`, `createdAt`
- Aggregates: `ordersCount`, `totalSpent`, `lastOrderDate`

**No** `whatsapp` field.

---

### Get one customer — `GET /api/customers/:id`

Same as above: customer object has **`phone`**, no **`whatsapp`**.

---

## Frontend checklist

- [ ] Remove `whatsapp` from all customer types/interfaces.
- [ ] Remove whatsapp input/display from customer create and edit forms.
- [ ] Require **phone** in the create-customer form and in validation.
- [ ] Ensure create-customer request body includes `name` and `phone` and does **not** include `whatsapp`.
- [ ] Ensure update-customer request body does **not** include `whatsapp`.
- [ ] Update customer list/detail UI to use only `phone` (no whatsapp column or field).
