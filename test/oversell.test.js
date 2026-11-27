
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createBookingService } from '../src/services/bookingService.js';

describe('SQLite overselling protection', () => {
  it('allows exactly one of 50 attendees to book the last ticket', async () => {
    const directory = mkdtempSync(
      join(tmpdir(), 'ticketing-oversell-')
    );

    const databasePath = join(directory, 'test.sqlite');
    const database = openDatabase(databasePath);

    try {
      const repository = createSqliteRepository(database);

      const bookingService = createBookingService(
        repository,
        {
          charge: async () => ({
            success: true,
            transactionId: 'test-payment',
          }),
        }
      );

      const event = {
        id: 'oversell-test-event',
        organizerId: 'oversell-test-organizer',
        title: 'Overselling Test',
        city: 'Lagos',
        venue: 'Test Venue',
        startsAt: '2026-12-05T17:00:00.000Z',
        status: 'published',
        tierIds: ['oversell-test-tier'],
      };

      const tier = {
        id: 'oversell-test-tier',
        eventId: event.id,
        name: 'Last Ticket',
        priceCents: 500000,
        capacity: 1,
        sold: 0,
      };

      await repository.saveEvent(event);
      await repository.saveTier(tier);

      const attempts = Array.from(
        { length: 50 },
        (_, index) =>
          bookingService.createBooking({
            tierId: tier.id,
            quantity: 1,
            userId: `attendee-${index + 1}`,
          })
      );

      const results = await Promise.allSettled(attempts);

      const successfulBookings = results.filter(
        (result) => result.status === 'fulfilled'
      );

      const soldOutBookings = results.filter(
        (result) =>
          result.status === 'rejected' &&
          result.reason?.code === 'SOLD_OUT'
      );

      const otherFailures = results.filter(
        (result) =>
          result.status === 'rejected' &&
          result.reason?.code !== 'SOLD_OUT'
      );

      const savedBookings = await repository.listBookings();
      const updatedTier = await repository.getTier(tier.id);

      const actualTicketsBooked = savedBookings
        .filter((booking) => booking.tierId === tier.id)
        .reduce((total, booking) => total + booking.quantity, 0);

      assert.equal(successfulBookings.length, 1);
      assert.equal(soldOutBookings.length, 49);
      assert.equal(otherFailures.length, 0);
      assert.equal(actualTicketsBooked, 1);
      assert.equal(updatedTier.sold, 1);
      assert.ok(updatedTier.sold <= updatedTier.capacity);
    } finally {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
