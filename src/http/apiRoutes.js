
import { createMemoryRepository } from '../repositories/memory.js';
import { createEventService } from '../services/eventService.js';
import { createBookingService } from '../services/bookingService.js';
import { createMockPaymentGateway } from '../lib/mockPaymentGateway.js';
import { Router } from './router.js';
import { DomainError } from '../domain/errors.js';

function requireBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DomainError('VALIDATION', 'A JSON object is required');
  }

  return body;
}

function requireUser(request) {
  const userId = request.headers['x-user-id'];

  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('VALIDATION', 'The x-user-id header is required');
  }

  return userId.trim();
}

function parseBoolean(value) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new DomainError('VALIDATION', 'onlyAvailable must be true or false');
}

function parseOptionalNumber(value, field) {
  if (value === undefined) return undefined;

  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new DomainError('VALIDATION', `${field} must be a whole number`);
  }

  return number;
}

export function createApiRouter({
  repository = createMemoryRepository(),
  paymentGateway = createMockPaymentGateway(),
} = {}) {
  const router = new Router();

  const eventService = createEventService(repository);
  const bookingService = createBookingService(repository, paymentGateway);

  // S02: Create an event.
  router.post('/api/events', async ({ request, body }) => {
    const data = requireBody(body);
    const event = await eventService.createEvent({
      ...data,
      organizerId: requireUser(request),
    });

    return { status: 201, body: event };
  });

  // S03: Add a ticket tier to an event.
  router.post('/api/events/:id/tiers', async ({ params, body }) => {
    const data = requireBody(body);
    const tier = await eventService.addTier(params.id, data);

    return { status: 201, body: tier };
  });

  // S04: Publish an event.
  router.post('/api/events/:id/publish', async ({ params }) => {
    const event = await eventService.publishEvent(params.id);

    return { status: 200, body: event };
  });

  // S04: Unpublish an event.
  router.post('/api/events/:id/unpublish', async ({ params }) => {
    const event = await eventService.unpublishEvent(params.id);

    return { status: 200, body: event };
  });

  // S05: Search and sort published events.
  router.get('/api/events', async ({ request }) => {
    const params = new URL(request.url, 'http://localhost').searchParams;

    const criteria = {
      q: params.get('q') ?? undefined,
      city: params.get('city') ?? undefined,
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      maxPriceCents: parseOptionalNumber(
        params.get('maxPriceCents') ?? undefined,
        'maxPriceCents'
      ),
      onlyAvailable: parseBoolean(
        params.get('onlyAvailable') ?? undefined
      ),
    };

    const sortBy = params.get('sort') ?? 'date';
    const events = await eventService.listEvents(criteria, sortBy);

    return { status: 200, body: { events } };
  });

  // S06: Book tickets.
  router.post('/api/bookings', async ({ request, body }) => {
    const data = requireBody(body);

    const booking = await bookingService.createBooking({
      ...data,
      userId: requireUser(request),
    });

    return { status: 201, body: booking };
  });

  // S07: Make a mock payment.
  router.post('/api/bookings/:reference/pay', async ({ request, params, body }) => {
    const data = body === undefined ? {} : requireBody(body);

    const booking = await bookingService.payBooking({
      reference: params.reference,
      userId: requireUser(request),
      outcome: data.outcome ?? 'approved',
    });

    return { status: 200, body: booking };
  });

  // Cancel an unpaid booking.
  router.post('/api/bookings/:reference/cancel', async ({ request, params }) => {
    const booking = await bookingService.cancelBooking({
      reference: params.reference,
      userId: requireUser(request),
    });

    return { status: 200, body: booking };
  });

  return router;
}
