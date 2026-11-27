
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createBookingService } from '../src/services/bookingService.js';

const database = openDatabase();
const repository = createSqliteRepository(database);
const bookingService = createBookingService(repository, {});

try {
  const eventId = randomUUID();
  const tierId = randomUUID();

  const event = {
    id: eventId,
    organizerId: 'oversell-demo-organizer',
    title: 'Overselling Test Event',
    city: 'Lagos',
    venue: 'Test Venue',
    startsAt: '2026-12-05T17:00:00.000Z',
    status: 'published',
    tierIds: [tierId],
  };

  const tier = {
    id: tierId,
    eventId,
    name: 'Last Ticket',
    priceCents: 500000,
    capacity: 1,
    sold: 0,
  };

  await repository.saveEvent(event);
  await repository.saveTier(tier);

  console.log('Created test event with exactly one available seat.');
  console.log('Launching 50 simultaneous booking requests...\n');

  const requests = Array.from({ length: 50 }, (_, index) =>
    bookingService.createBooking({
      tierId,
      quantity: 1,
      userId: `attendee-${index + 1}`,
    })
  );

  const results = await Promise.allSettled(requests);

  const successes = results.filter(
    (result) => result.status === 'fulfilled'
  );

  const soldOut = results.filter(
    (result) =>
      result.status === 'rejected' &&
      result.reason?.code === 'SOLD_OUT'
  );

  const otherFailures = results.filter(
    (result) =>
      result.status === 'rejected' &&
      result.reason?.code !== 'SOLD_OUT'
  );

  const bookings = (await repository.listBookings()).filter(
    (booking) => booking.tierId === tierId
  );

  const updatedTier = await repository.getTier(tierId);

  console.log('OVERSelling DEMONSTRATION RESULTS');
  console.log('---------------------------------');
  console.log(`Successful bookings: ${successes.length}`);
  console.log(`SOLD_OUT responses: ${soldOut.length}`);
  console.log(`Other failures: ${otherFailures.length}`);
  console.log(`Actual tickets booked: ${
    bookings.reduce((total, booking) => total + booking.quantity, 0)
  }`);
  console.log(`Database sold counter: ${updatedTier.sold}`);
  console.log(`Ticket capacity: ${updatedTier.capacity}`);
} finally {
  database.close();
}
