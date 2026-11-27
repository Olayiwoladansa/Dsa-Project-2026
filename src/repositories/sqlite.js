
function ensureUser(database, userId) {
  database.prepare(
    'INSERT OR IGNORE INTO users (id) VALUES (?)'
  ).run(userId);
}

function mapEvent(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
    tierIds: JSON.parse(row.tier_ids),
  };
}

function mapTier(row) {
  if (!row) return null;

  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
  };
}

function mapBooking(row) {
  if (!row) return null;

  const booking = {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };

  if (row.payment_transaction_id !== null) {
    booking.paymentTransactionId = row.payment_transaction_id;
  }

  return booking;
}

export function createSqliteRepository(database) {
  if (!database) {
    throw new TypeError('A SQLite database connection is required');
  }

  return {
    // Events
    async saveEvent(event) {
      ensureUser(database, event.organizerId);

      database.prepare(`
        INSERT INTO events (
          id, organizer_id, title, city, venue,
          starts_at, status, tier_ids
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          organizer_id = excluded.organizer_id,
          title = excluded.title,
          city = excluded.city,
          venue = excluded.venue,
          starts_at = excluded.starts_at,
          status = excluded.status,
          tier_ids = excluded.tier_ids
      `).run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status,
        JSON.stringify(event.tierIds)
      );

      return event;
    },

    async getEvent(eventId) {
      const row = database.prepare(
        'SELECT * FROM events WHERE id = ?'
      ).get(eventId);

      return mapEvent(row);
    },

    async listEvents() {
      const rows = database.prepare(
        'SELECT * FROM events ORDER BY rowid'
      ).all();

      return rows.map(mapEvent);
    },

    // Ticket tiers
    async saveTier(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (
          id, event_id, name, price_cents, capacity, sold
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          event_id = excluded.event_id,
          name = excluded.name,
          price_cents = excluded.price_cents,
          capacity = excluded.capacity,
          sold = excluded.sold
      `).run(
        tier.id,
        tier.eventId,
        tier.name,
        tier.priceCents,
        tier.capacity,
        tier.sold
      );

      return tier;
    },

    async reserveSeats(tierId, quantity) {
      const result = database.prepare(`
        UPDATE ticket_tiers
        SET sold = sold + ?
        WHERE id = ?
          AND sold + ? <= capacity
      `).run(quantity, tierId, quantity);

      if (result.changes !== 1) {
        return null;
      }

      const row = database.prepare(
        'SELECT * FROM ticket_tiers WHERE id = ?'
      ).get(tierId);

      return mapTier(row);
    },

    async getTier(tierId) {
      const row = database.prepare(
        'SELECT * FROM ticket_tiers WHERE id = ?'
      ).get(tierId);

      return mapTier(row);
    },

    async listTiersByEvent(eventId) {
      const rows = database.prepare(
        'SELECT * FROM ticket_tiers WHERE event_id = ? ORDER BY rowid'
      ).all(eventId);

      return rows.map(mapTier);
    },

    // Bookings
    async saveBooking(booking) {
      ensureUser(database, booking.userId);

      database.prepare(`
        INSERT INTO bookings (
          id, reference, user_id, tier_id, quantity,
          amount_cents, status, created_at, payment_transaction_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          reference = excluded.reference,
          user_id = excluded.user_id,
          tier_id = excluded.tier_id,
          quantity = excluded.quantity,
          amount_cents = excluded.amount_cents,
          status = excluded.status,
          created_at = excluded.created_at,
          payment_transaction_id = excluded.payment_transaction_id
      `).run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
        booking.paymentTransactionId ?? null
      );

      return booking;
    },

    async getBooking(bookingId) {
      const row = database.prepare(
        'SELECT * FROM bookings WHERE id = ?'
      ).get(bookingId);

      return mapBooking(row);
    },

    async getBookingByReference(reference) {
      const row = database.prepare(
        'SELECT * FROM bookings WHERE reference = ?'
      ).get(reference);

      return mapBooking(row);
    },

    async listBookings() {
      const rows = database.prepare(
        'SELECT * FROM bookings ORDER BY rowid'
      ).all();

      return rows.map(mapBooking);
    },
  };
}
