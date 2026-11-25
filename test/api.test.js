
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../src/http/app.js';
import { createMemoryRepository } from '../src/repositories/memory.js';

describe('REST API', () => {
  const repository = createMemoryRepository();
  let chargeCalls = 0;

  const paymentGateway = {
    async charge({ outcome = 'approved' } = {}) {
      chargeCalls += 1;

      if (outcome === 'declined') {
        return {
          success: false,
          code: 'PAYMENT_DECLINED',
          message: 'The mock payment was declined',
        };
      }

      return {
        success: true,
        transactionId: `TEST-${chargeCalls}`,
      };
    },
  };

  const server = createAppServer({
    repository,
    paymentGateway,
  });

  let baseUrl;

  before(async () => {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });

  async function request(
    path,
    {
      method = 'GET',
      userId,
      body,
    } = {}
  ) {
    const headers = {};

    if (userId) {
      headers['x-user-id'] = userId;
    }

    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.json();

    return {
      response,
      payload,
    };
  }

  async function createPublishedEvent({
    title = 'Lagos Tech Meetup',
    capacity = 5,
  } = {}) {
    const eventResult = await request('/api/events', {
      method: 'POST',
      userId: 'organizer-1',
      body: {
        title,
        city: 'Lagos',
        venue: 'Yaba Hub',
        startsAt: '2027-06-01T17:00:00.000Z',
      },
    });

    assert.equal(eventResult.response.status, 201);

    const event = eventResult.payload;

    const tierResult = await request(
      `/api/events/${event.id}/tiers`,
      {
        method: 'POST',
        body: {
          name: 'General',
          priceCents: 500000,
          capacity,
        },
      }
    );

    assert.equal(tierResult.response.status, 201);

    const tier = tierResult.payload;

    const publishResult = await request(
      `/api/events/${event.id}/publish`,
      {
        method: 'POST',
      }
    );

    assert.equal(publishResult.response.status, 200);

    return {
      event,
      tier,
    };
  }

  async function createBooking(
    eventId,
    tierId,
    {
      userId = 'attendee-1',
      quantity = 1,
    } = {}
  ) {
    return request('/api/bookings', {
      method: 'POST',
      userId,
      body: {
        eventId,
        tierId,
        quantity,
      },
    });
  }

  it('creates, adds a tier to, publishes, and searches an event', async () => {
    const { event } = await createPublishedEvent({
      title: 'Lagos Technology Conference',
    });

    const searchResult = await request(
      '/api/events?city=Lagos'
    );

    assert.equal(searchResult.response.status, 200);
    assert.ok(Array.isArray(searchResult.payload.events));

    const foundEvent = searchResult.payload.events.find(
      (item) => item.id === event.id
    );

    assert.ok(foundEvent);
    assert.equal(foundEvent.title, 'Lagos Technology Conference');
  });

  it('unpublishes an event and removes it from public search', async () => {
    const { event } = await createPublishedEvent({
      title: 'Event To Unpublish',
    });

    const unpublishResult = await request(
      `/api/events/${event.id}/unpublish`,
      {
        method: 'POST',
      }
    );

    assert.equal(unpublishResult.response.status, 200);
    assert.equal(unpublishResult.payload.status, 'draft');

    const searchResult = await request(
      '/api/events?city=Lagos'
    );

    assert.equal(searchResult.response.status, 200);

    const foundEvent = searchResult.payload.events.find(
      (item) => item.id === event.id
    );

    assert.equal(foundEvent, undefined);
  });

  it('creates a booking and successfully pays for it', async () => {
    const { event, tier } = await createPublishedEvent();

    const bookingResult = await createBooking(event.id, tier.id);

    assert.equal(bookingResult.response.status, 201);

    const reference = bookingResult.payload.reference;

    assert.ok(reference);
    assert.equal(bookingResult.payload.status, 'pending');

    const previousChargeCalls = chargeCalls;

    const paymentResult = await request(
      `/api/bookings/${reference}/pay`,
      {
        method: 'POST',
        userId: 'attendee-1',
        body: {
          outcome: 'approved',
        },
      }
    );

    assert.equal(paymentResult.response.status, 200);
    assert.equal(paymentResult.payload.status, 'paid');
    assert.ok(paymentResult.payload.paymentTransactionId);

    assert.equal(chargeCalls, previousChargeCalls + 1);

    // Paying again must be rejected without charging again.
    const repeatedPayment = await request(
      `/api/bookings/${reference}/pay`,
      {
        method: 'POST',
        userId: 'attendee-1',
        body: {
          outcome: 'approved',
        },
      }
    );

    assert.equal(repeatedPayment.response.status, 409);
    assert.equal(
      repeatedPayment.payload.error.code,
      'INVALID_TRANSITION'
    );

    assert.equal(chargeCalls, previousChargeCalls + 1);
  });

  it('keeps a declined booking pending and allows payment retry', async () => {
    const { event, tier } = await createPublishedEvent();

    const bookingResult = await createBooking(event.id, tier.id);

    assert.equal(bookingResult.response.status, 201);

    const reference = bookingResult.payload.reference;

    assert.ok(reference);
    assert.equal(bookingResult.payload.status, 'pending');

    const previousChargeCalls = chargeCalls;

    const declinedResult = await request(
      `/api/bookings/${reference}/pay`,
      {
        method: 'POST',
        userId: 'attendee-1',
        body: {
          outcome: 'declined',
        },
      }
    );

    assert.equal(declinedResult.response.status, 409);

    assert.equal(
      declinedResult.payload.error.code,
      'PAYMENT_DECLINED'
    );

    // Retry payment. This should succeed because the declined
    // attempt must leave the booking in pending status.
    const retryResult = await request(
      `/api/bookings/${reference}/pay`,
      {
        method: 'POST',
        userId: 'attendee-1',
        body: {
          outcome: 'approved',
        },
      }
    );

    assert.equal(retryResult.response.status, 200);
    assert.equal(retryResult.payload.status, 'paid');
    assert.ok(retryResult.payload.paymentTransactionId);

    // One declined attempt and one successful retry.
    assert.equal(chargeCalls, previousChargeCalls + 2);
  });

  it('does not allow another user to pay for a booking', async () => {
    const { event, tier } = await createPublishedEvent();

    const bookingResult = await createBooking(event.id, tier.id);

    assert.equal(bookingResult.response.status, 201);

    const reference = bookingResult.payload.reference;
    const previousChargeCalls = chargeCalls;

    const paymentResult = await request(
      `/api/bookings/${reference}/pay`,
      {
        method: 'POST',
        userId: 'another-attendee',
        body: {
          outcome: 'approved',
        },
      }
    );

    assert.equal(paymentResult.response.status, 403);
    assert.equal(
      paymentResult.payload.error.code,
      'FORBIDDEN'
    );

    assert.equal(chargeCalls, previousChargeCalls);
  });

  it('rejects bookings when a ticket tier is sold out', async () => {
    const { event, tier } = await createPublishedEvent({
      capacity: 1,
    });

    const firstBooking = await createBooking(event.id, tier.id);

    assert.equal(firstBooking.response.status, 201);

    const secondBooking = await createBooking(
      event.id,
      tier.id,
      {
        userId: 'attendee-2',
      }
    );

    assert.equal(secondBooking.response.status, 409);
    assert.equal(
      secondBooking.payload.error.code,
      'SOLD_OUT'
    );
  });

  it('cancels an unpaid booking and releases its seat', async () => {
    const { event, tier } = await createPublishedEvent({
      capacity: 1,
    });

    const bookingResult = await createBooking(event.id, tier.id);

    assert.equal(bookingResult.response.status, 201);

    const reference = bookingResult.payload.reference;

    const cancelResult = await request(
      `/api/bookings/${reference}/cancel`,
      {
        method: 'POST',
        userId: 'attendee-1',
      }
    );

    assert.equal(cancelResult.response.status, 200);
    assert.equal(cancelResult.payload.status, 'cancelled');

    // The cancelled booking should release its seat.
    const replacementBooking = await createBooking(
      event.id,
      tier.id,
      {
        userId: 'attendee-2',
      }
    );

    assert.equal(replacementBooking.response.status, 201);
  });

  it('rejects requests without the required user header', async () => {
    const result = await request('/api/events', {
      method: 'POST',
      body: {
        title: 'Test Event',
        city: 'Lagos',
        venue: 'Yaba Hub',
        startsAt: '2027-06-01T17:00:00.000Z',
      },
    });

    assert.equal(result.response.status, 400);
    assert.equal(result.payload.error.code, 'VALIDATION');
  });
});
