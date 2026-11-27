
import { events, tiers } from './mockData.js';

const bookings = [];
const HOLD_DURATION_MS = 10 * 60 * 1000;
const MAX_TICKETS_PER_BOOKING = 10;

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function availableSeats(tier) {
  return tier.capacity - tier.sold;
}

function releaseExpiredBookings() {
  const now = Date.now();

  for (const booking of bookings) {
    if (
      booking.status === 'pending' &&
      Date.parse(booking.expiresAt) <= now
    ) {
      const tier = tiers.find((item) => item.id === booking.tierId);

      if (tier) {
        tier.sold -= booking.quantity;
      }

      booking.status = 'expired';
    }
  }
}

function summarizeEvent(event) {
  const eventTiers = tiers.filter(
    (tier) => tier.eventId === event.id
  );

  return {
    ...event,
    tierCount: eventTiers.length,
    minPriceCents: eventTiers.length
      ? Math.min(...eventTiers.map((tier) => tier.priceCents))
      : null,
    seatsLeft: eventTiers.reduce(
      (total, tier) => total + availableSeats(tier),
      0
    ),
  };
}

export async function listEvents(criteria = {}) {
  await delay();
  releaseExpiredBookings();

  let results = events
    .filter((event) => event.status === 'published')
    .map(summarizeEvent);

  const searchText = criteria.q?.trim().toLowerCase();
  const city = criteria.city?.trim().toLowerCase();

  if (searchText) {
    results = results.filter((event) =>
      `${event.title} ${event.venue}`
        .toLowerCase()
        .includes(searchText)
    );
  }

  if (city) {
    results = results.filter(
      (event) => event.city.toLowerCase() === city
    );
  }

  if (criteria.from) {
    const from = Date.parse(criteria.from);

    if (Number.isNaN(from)) {
      throw createError('VALIDATION', 'Invalid start date');
    }

    results = results.filter(
      (event) => Date.parse(event.startsAt) >= from
    );
  }

  if (criteria.to) {
    const to = Date.parse(criteria.to);

    if (Number.isNaN(to)) {
      throw createError('VALIDATION', 'Invalid end date');
    }

    const endOfDay = /^\d{4}-\d{2}-\d{2}$/.test(criteria.to)
      ? to + 24 * 60 * 60 * 1000 - 1
      : to;

    results = results.filter(
      (event) => Date.parse(event.startsAt) <= endOfDay
    );
  }

  if (criteria.maxPriceCents !== undefined) {
    if (
      !Number.isInteger(criteria.maxPriceCents) ||
      criteria.maxPriceCents < 0
    ) {
      throw createError(
        'VALIDATION',
        'Maximum price must be a non-negative whole number'
      );
    }

    results = results.filter(
      (event) =>
        event.minPriceCents !== null &&
        event.minPriceCents <= criteria.maxPriceCents
    );
  }

  if (criteria.onlyAvailable) {
    results = results.filter((event) => event.seatsLeft > 0);
  }

  const sortBy = criteria.sort ?? 'date';

  if (sortBy === 'date') {
    results.sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt)
    );
  } else if (sortBy === 'price') {
    results.sort(
      (a, b) =>
        (a.minPriceCents ?? Infinity) -
        (b.minPriceCents ?? Infinity)
    );
  } else if (sortBy === 'availability') {
    results.sort((a, b) => b.seatsLeft - a.seatsLeft);
  } else {
    throw createError('VALIDATION', 'Invalid sort option');
  }

  return { events: results };
}

export async function getEvent(eventId) {
  await delay();
  releaseExpiredBookings();

  const event = events.find((item) => item.id === eventId);

  if (!event || event.status !== 'published') {
    throw createError('NOT_FOUND', 'Event not found');
  }

  return {
    ...event,
    tiers: tiers
      .filter((tier) => tier.eventId === eventId)
      .map((tier) => ({ ...tier })),
  };
}

export async function createBooking({
  eventId,
  tierId,
  quantity,
}) {
  await delay();
  releaseExpiredBookings();

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_TICKETS_PER_BOOKING
  ) {
    throw createError(
      'VALIDATION',
      `Quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`
    );
  }

  const event = events.find(
    (item) => item.id === eventId && item.status === 'published'
  );

  if (!event) {
    throw createError('NOT_FOUND', 'Event not found');
  }

  const tier = tiers.find(
    (item) => item.id === tierId && item.eventId === eventId
  );

  if (!tier) {
    throw createError('NOT_FOUND', 'Ticket tier not found');
  }

  const left = availableSeats(tier);

  if (left < quantity) {
    throw createError(
      'SOLD_OUT',
      left === 0
        ? `${tier.name} is sold out`
        : `Only ${left} ticket(s) left in ${tier.name}`
    );
  }

  tier.sold += quantity;

  const now = new Date();

  const booking = {
    id: crypto.randomUUID(),
    reference: crypto.randomUUID().slice(0, 8).toUpperCase(),
    userId: 'attendee-1',
    eventId,
    tierId,
    quantity,
    amountCents: tier.priceCents * quantity,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(
      now.getTime() + HOLD_DURATION_MS
    ).toISOString(),
  };

  bookings.push(booking);

  return { ...booking };
}

export async function pay(reference, outcome = 'approved') {
  await delay();
  releaseExpiredBookings();

  const booking = bookings.find(
    (item) => item.reference === reference
  );

  if (!booking) {
    throw createError('NOT_FOUND', 'Booking not found');
  }

  if (booking.status !== 'pending') {
    throw createError(
      'INVALID_STATE',
      'This booking cannot be paid'
    );
  }

  if (outcome === 'declined') {
    throw createError(
      'PAYMENT_DECLINED',
      'The mock payment was declined. Please try again.'
    );
  }

  if (outcome !== 'approved') {
    throw createError('VALIDATION', 'Invalid payment outcome');
  }

  booking.status = 'paid';
  booking.paymentTransactionId = `MOCK-${Date.now()}`;

  return { ...booking };
}
