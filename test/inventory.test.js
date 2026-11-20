
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  unpublishEvent,
  listEventSummaries,
  bookTickets,
  cancelBooking,
  joinWaitlist,
  offerNextOnWaitlist,
  findBookingByReference,
  seatsLeft,
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const throwsCode = (fn, code) =>
  assert.throws(
    fn,
    (error) => error instanceof DomainError && error.code === code,
  );

describe('inventory', () => {
  let store;
  let event;
  let tier;

  beforeEach(() => {
    store = createStore();

    event = createEvent(store, {
      title: 'Test Event',
      city: 'Lagos',
      startsAt: '2026-12-05T17:00:00Z',
      organizerId: 'org-1',
    });

    tier = addTier(store, event.id, {
      name: 'General',
      priceCents: 2500,
      capacity: 3,
    });
  });

  describe('creating events and tiers', () => {
    it('starts events as drafts', () => {
      assert.equal(event.status, 'draft');
    });

    it('creates an event with a unique ID and saves it in the store', () => {
      const anotherEvent = createEvent(store, {
        title: 'Lagos Music Festival',
        city: 'Lagos',
        startsAt: '2026-12-10T18:00:00Z',
        organizerId: 'org-1',
      });

      assert.ok(event.id);
      assert.ok(anotherEvent.id);
      assert.notEqual(event.id, anotherEvent.id);
      assert.equal(store.events.get(anotherEvent.id), anotherEvent);
      assert.equal(anotherEvent.status, 'draft');
    });

    it('rejects a missing title, missing city, and invalid date', () => {
      const eventsBefore = store.events.size;

      throwsCode(
        () =>
          createEvent(store, {
            title: ' ',
            city: 'Lagos',
            startsAt: '2026-12-05T17:00:00Z',
          }),
        'VALIDATION',
      );

      throwsCode(
        () =>
          createEvent(store, {
            title: 'Lagos Music Festival',
            city: ' ',
            startsAt: '2026-12-05T17:00:00Z',
          }),
        'VALIDATION',
      );

      throwsCode(
        () =>
          createEvent(store, {
            title: 'Lagos Music Festival',
            city: 'Lagos',
            startsAt: 'nope',
          }),
        'VALIDATION',
      );

      assert.equal(store.events.size, eventsBefore);
    });

    it('creates a ticket tier with zero sold and the correct remaining capacity', () => {
      assert.ok(tier.id);
      assert.equal(tier.name, 'General');
      assert.equal(tier.priceCents, 2500);
      assert.equal(tier.capacity, 3);
      assert.equal(tier.sold, 0);
      assert.equal(seatsLeft(tier), 3);
      assert.ok(event.tierIds.includes(tier.id));
      assert.equal(store.tiers.get(tier.id), tier);
    });

    it('rejects adding a tier to an unknown event', () => {
      const tiersBefore = store.tiers.size;

      throwsCode(
        () =>
          addTier(store, 'unknown-event-id', {
            name: 'VIP',
            priceCents: 5000,
            capacity: 10,
          }),
        'NOT_FOUND',
      );

      assert.equal(store.tiers.size, tiersBefore);
    });

    it('rejects invalid ticket prices and capacities', () => {
      throwsCode(
        () =>
          addTier(store, event.id, {
            name: 'VIP',
            priceCents: 19.99,
            capacity: 5,
          }),
        'VALIDATION',
      );

      throwsCode(
        () =>
          addTier(store, event.id, {
            name: 'VIP',
            priceCents: 100,
            capacity: 0,
          }),
        'VALIDATION',
      );
    });

    it('cannot publish an event with no tiers', () => {
      const empty = createEvent(store, {
        title: 'Empty',
        city: 'Abuja',
        startsAt: '2026-12-06',
      });

      throwsCode(() => publishEvent(store, empty.id), 'INVALID_STATE');

      assert.equal(empty.status, 'draft');
      assert.equal(publishEvent(store, event.id).status, 'published');
    });

    it('unpublishes an event and removes it from the public list', () => {
      publishEvent(store, event.id);

      assert.equal(event.status, 'published');
      assert.equal(listEventSummaries(store).length, 1);

      unpublishEvent(store, event.id);

      assert.equal(event.status, 'draft');
      assert.equal(listEventSummaries(store).length, 0);
    });
  });

  describe('booking', () => {
    beforeEach(() => {
      publishEvent(store, event.id);
    });

    it('reduces the seats left and prices in whole cents', () => {
      const booking = bookTickets(store, tier.id, 'ada', 2);

      assert.equal(booking.amountCents, 5000);
      assert.equal(booking.status, 'pending');
      assert.equal(seatsLeft(tier), 1);
    });

    it('rejects a booking bigger than the seats left, and changes nothing', () => {
      bookTickets(store, tier.id, 'ada', 2);

      const bookingsBefore = store.bookings.size;
      const referencesBefore = store.bookingsByReference.size;

      throwsCode(() => bookTickets(store, tier.id, 'bayo', 2), 'SOLD_OUT');

      assert.equal(seatsLeft(tier), 1);
      assert.equal(store.bookings.size, bookingsBefore);
      assert.equal(store.bookingsByReference.size, referencesBefore);
    });

    it('lets the last ticket be booked, then reports sold out', () => {
      bookTickets(store, tier.id, 'ada', 3);

      assert.equal(seatsLeft(tier), 0);

      throwsCode(() => bookTickets(store, tier.id, 'bayo', 1), 'SOLD_OUT');
    });

    it('validates the quantity', () => {
      for (const bad of [0, -1, 1.5, 11, '2', undefined]) {
        throwsCode(
          () => bookTickets(store, tier.id, 'ada', bad),
          'VALIDATION',
        );
      }
    });

    it('finds a booking by its reference code', () => {
      const booking = bookTickets(store, tier.id, 'ada', 1);

      assert.match(booking.reference, /^[A-Z2-9]{8}$/);
      assert.equal(findBookingByReference(store, booking.reference), booking);
      assert.equal(findBookingByReference(store, 'NOPE0000'), undefined);
    });
  });

  describe('cancelling', () => {
    beforeEach(() => {
      publishEvent(store, event.id);
    });

    it('gives the seats back', () => {
      const booking = bookTickets(store, tier.id, 'ada', 2);

      cancelBooking(store, booking.reference);

      assert.equal(seatsLeft(tier), 3);
      assert.equal(booking.status, 'cancelled');
    });

    it('cannot be done twice (seats are released once)', () => {
      const booking = bookTickets(store, tier.id, 'ada', 2);

      cancelBooking(store, booking.reference);

      throwsCode(
        () => cancelBooking(store, booking.reference),
        'INVALID_STATE',
      );

      assert.equal(seatsLeft(tier), 3);
    });
  });

  describe('waitlist', () => {
    beforeEach(() => {
      publishEvent(store, event.id);
    });

    it('only opens when the tier cannot satisfy the request', () => {
      throwsCode(
        () => joinWaitlist(store, tier.id, 'ada', 1),
        'NOT_SOLD_OUT',
      );

      bookTickets(store, tier.id, 'bayo', 3);

      assert.deepEqual(joinWaitlist(store, tier.id, 'ada', 1), {
        position: 1,
      });

      assert.deepEqual(joinWaitlist(store, tier.id, 'chidi', 1), {
        position: 2,
      });
    });

    it('offers seats first come, first served', () => {
      const booking = bookTickets(store, tier.id, 'bayo', 3);

      joinWaitlist(store, tier.id, 'ada', 1);
      joinWaitlist(store, tier.id, 'chidi', 1);

      assert.equal(offerNextOnWaitlist(store, tier.id), undefined, 'no seats yet');

      cancelBooking(store, booking.reference);

      assert.equal(offerNextOnWaitlist(store, tier.id).userId, 'ada');
      assert.equal(offerNextOnWaitlist(store, tier.id).userId, 'chidi');
    });
  });
});
