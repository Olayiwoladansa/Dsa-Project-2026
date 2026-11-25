
# Build 4: REST API Examples

This document shows how to use the Event Ticketing API.

## Starting the server

Open PowerShell in the project root and run:

```powershell
npm.cmd start
```

The server runs at:

http://localhost:3000

Keep this terminal open while making API requests.

All examples use:

- `Content-Type: application/json` for JSON request bodies.
- `x-user-id` to identify the user making the request.
- Whole cents for ticket prices.

For Windows PowerShell, use `curl.exe` rather than `curl`.

---

## 1. Create an event

**Endpoint:** `POST /api/events`

The organizer creates an event. New events start as drafts.

```powershell
curl.exe -X POST http://localhost:3000/api/events `
  -H "Content-Type: application/json" `
  -H "x-user-id: organizer-1" `
  -d '{\"title\":\"Lagos Tech Meetup\",\"city\":\"Lagos\",\"venue\":\"Yaba Hub\",\"startsAt\":\"2027-06-01T17:00:00.000Z\"}'
```

Expected status: `201 Created`

The response contains the new event, including its unique ID.

Copy the event ID for the next request.

---

## 2. Add a ticket tier

**Endpoint:** `POST /api/events/:id/tiers`

Replace `EVENT_ID` with the ID returned when creating the event.

```powershell
curl.exe -X POST http://localhost:3000/api/events/EVENT_ID/tiers `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"General\",\"priceCents\":500000,\"capacity\":100}'
```

Expected status: `201 Created`

This creates a General ticket tier:

- Price: 500,000 cents.
- Capacity: 100 tickets.
- Initial tickets sold: 0.

Copy the tier ID for the booking request.

---

## 3. Publish an event

**Endpoint:** `POST /api/events/:id/publish`

Replace `EVENT_ID` with the event ID.

```powershell
curl.exe -X POST http://localhost:3000/api/events/EVENT_ID/publish
```

Expected status: `200 OK`

The event becomes available in public event searches.

An event must have at least one ticket tier before it can be published.


---

## 4. Unpublish an event

**Endpoint:** `POST /api/events/:id/unpublish`

Replace `EVENT_ID` with the event ID.

```powershell
curl.exe -X POST http://localhost:3000/api/events/EVENT_ID/unpublish
```

Expected status: `200 OK`

The event returns to draft status and is removed from public event searches.

To make it publicly available again, publish it using the publish endpoint.
---

## 5. Search and filter events

**Endpoint:** `GET /api/events`

Search all published events:

```powershell
curl.exe "http://localhost:3000/api/events"
```

Search by city:

```powershell
curl.exe "http://localhost:3000/api/events?city=Lagos"
```

Search by title or venue:

```powershell
curl.exe "http://localhost:3000/api/events?q=Tech"
```

Filter by maximum ticket price:

```powershell
curl.exe "http://localhost:3000/api/events?maxPriceCents=500000"
```

Show events with available tickets:

```powershell
curl.exe "http://localhost:3000/api/events?onlyAvailable=true"
```

Sort events by price:

```powershell
curl.exe "http://localhost:3000/api/events?sort=price"
```

Other supported sort values:

- `date`
- `price`
- `availability`

Expected status: `200 OK`

The response contains an `events` array.

---

## 6. Create a booking

**Endpoint:** `POST /api/bookings`

Replace `EVENT_ID` and `TIER_ID` with the IDs returned earlier.

```powershell
curl.exe -X POST http://localhost:3000/api/bookings `
  -H "Content-Type: application/json" `
  -H "x-user-id: attendee-1" `
  -d '{\"eventId\":\"EVENT_ID\",\"tierId\":\"TIER_ID\",\"quantity\":2}'
```

Expected status: `201 Created`

The response contains:

- Booking ID.
- Booking reference.
- User ID.
- Ticket tier ID.
- Quantity.
- Amount in cents.
- Booking status.

A new booking starts with status `pending`.

Copy the booking reference for payment or cancellation.

---

## 7. Make a successful mock payment

**Endpoint:** `POST /api/bookings/:reference/pay`

Replace `BOOKING_REFERENCE` with the booking reference.

```powershell
curl.exe -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay `
  -H "Content-Type: application/json" `
  -H "x-user-id: attendee-1" `
  -d '{\"outcome\":\"approved\"}'
```

Expected status: `200 OK`

The booking status changes from `pending` to `paid`.

The response includes a mock payment transaction reference.

This is a simulated payment. No real card details or money are processed.

---

## 8. Simulate a declined payment

Use a new pending booking for this example.

**Endpoint:** `POST /api/bookings/:reference/pay`

```powershell
curl.exe -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay `
  -H "Content-Type: application/json" `
  -H "x-user-id: attendee-1" `
  -d '{\"outcome\":\"declined\"}'
```

Expected status: `409 Conflict`

Expected error code:

`PAYMENT_DECLINED`

The booking remains `pending`, so the attendee can retry payment.

### Retry the payment

```powershell
curl.exe -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay `
  -H "Content-Type: application/json" `
  -H "x-user-id: attendee-1" `
  -d '{\"outcome\":\"approved\"}'
```

Expected status: `200 OK`

The booking should now be `paid`.

---

## 9. Cancel an unpaid booking

Use a pending booking that has not been paid.

**Endpoint:** `POST /api/bookings/:reference/cancel`

```powershell
curl.exe -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel `
  -H "x-user-id: attendee-1"
```

Expected status: `200 OK`

The booking status changes to `cancelled`.

The ticket seat is released and becomes available for another attendee.

Paid bookings cannot be cancelled through this Build 4 endpoint.

---

## Common API errors

All API errors use the same JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Description of the error"
  }
}
```

Common HTTP status codes:

| Status | Meaning |
|---|---|
| 201 | Resource successfully created |
| 200 | Request successfully completed |
| 400 | Invalid request or validation error |
| 403 | User is not allowed to perform the action |
| 404 | Resource or route not found |
| 409 | Conflict, such as sold out or invalid booking transition |
| 500 | Unexpected server error |

## Important notes

- This API uses in-memory storage. Data is lost when the server restarts.
- The payment gateway is a mock implementation.
- The `x-user-id` header is temporary identity handling for this build.
- Authentication and authorization will be developed in a later build.
- Database persistence and transaction locking are not implemented yet.
