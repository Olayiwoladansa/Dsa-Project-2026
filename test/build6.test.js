
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  listEvents,
  createBooking,
  pay,
} from '../public/js/api.js';

describe('Build 6 frontend mock API', () => {
  it('shows only events with available seats when requested', async () => {
    const result = await listEvents({ onlyAvailable: true });

    assert.equal(result.events.length, 3);

    for (const event of result.events) {
      assert.ok(event.seatsLeft > 0);
    }
  });

  it('rejects a booking quantity above 10 tickets', async () => {
    await assert.rejects(
      createBooking({
        eventId: 'event-1',
        tierId: 'tier-1',
        quantity: 11,
      }),
      (error) => error.code === 'VALIDATION'
    );
  });

  it('rejects a booking for a sold-out ticket tier', async () => {
    await assert.rejects(
      createBooking({
        eventId: 'event-3',
        tierId: 'tier-5',
        quantity: 1,
      }),
      (error) => error.code === 'SOLD_OUT'
    );
  });

  it('allows a declined payment to be retried successfully', async () => {
    const booking = await createBooking({
      eventId: 'event-1',
      tierId: 'tier-1',
      quantity: 2,
    });

    await assert.rejects(
      pay(booking.reference, 'declined'),
      (error) => error.code === 'PAYMENT_DECLINED'
    );

    const paidBooking = await pay(booking.reference, 'approved');

    assert.equal(paidBooking.status, 'paid');
    assert.equal(paidBooking.reference, booking.reference);
  });
});
