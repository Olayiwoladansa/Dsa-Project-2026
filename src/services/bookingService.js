
import { newId, referenceCode } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';

const MAX_TICKETS_PER_BOOKING = 10;

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError('VALIDATION', 'User ID is required');
  }

  return userId.trim();
}

export function createBookingService(repository, paymentGateway) {
  if (!repository || !paymentGateway) {
    throw new TypeError('A repository and payment gateway are required');
  }

  return {
    async createBooking({ tierId, quantity, userId }) {
      const ownerId = requireUserId(userId);

      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_TICKETS_PER_BOOKING
      ) {
        throw new DomainError(
          'VALIDATION',
          `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`
        );
      }

      const tier = await repository.getTier(tierId);

      if (!tier) {
        throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      }

      const event = await repository.getEvent(tier.eventId);

      if (!event) {
        throw new DomainError('NOT_FOUND', 'Event not found');
      }

      if (event.status !== 'published') {
        throw new DomainError('INVALID_STATE', 'Event is not published');
      }

      const seatsLeft = tier.capacity - tier.sold;

      if (seatsLeft < quantity) {
        const message = seatsLeft === 0
          ? `${tier.name} is sold out`
          : `Only ${seatsLeft} ticket(s) left in ${tier.name}`;

        throw new DomainError('SOLD_OUT', message, { seatsLeft });
      }

      let reference;

      do {
        reference = referenceCode();
      } while (await repository.getBookingByReference(reference));

      const booking = {
        id: newId(),
        reference,
        userId: ownerId,
        tierId,
        quantity,
        amountCents: tier.priceCents * quantity,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      tier.sold += quantity;

      await repository.saveTier(tier);
      await repository.saveBooking(booking);

      return booking;
    },

    async payBooking({ reference, userId, outcome = 'approved' }) {
      const ownerId = requireUserId(userId);
      const booking = await repository.getBookingByReference(reference);

      if (!booking) {
        throw new DomainError('NOT_FOUND', 'Booking not found');
      }

      if (booking.userId !== ownerId) {
        throw new DomainError(
          'FORBIDDEN',
          "You cannot pay for another user's booking"
        );
      }

      assertTransition(booking.status, 'paid');

      const payment = await paymentGateway.charge({ outcome });

      if (!payment.success) {
        throw new DomainError(
          payment.code,
          payment.message
        );
      }

      booking.status = 'paid';
      booking.paymentTransactionId = payment.transactionId;

      await repository.saveBooking(booking);

      return booking;
    },

    async cancelBooking({ reference, userId }) {
      const ownerId = requireUserId(userId);
      const booking = await repository.getBookingByReference(reference);

      if (!booking) {
        throw new DomainError('NOT_FOUND', 'Booking not found');
      }

      if (booking.userId !== ownerId) {
        throw new DomainError(
          'FORBIDDEN',
          "You cannot cancel another user's booking"
        );
      }

      assertTransition(booking.status, 'cancelled');

      if (booking.status !== 'pending') {
        throw new DomainError(
          'INVALID_STATE',
          'Only unpaid bookings can be cancelled in Build 4'
        );
      }

      const tier = await repository.getTier(booking.tierId);

      if (!tier) {
        throw new DomainError('NOT_FOUND', 'Ticket tier not found');
      }

      tier.sold -= booking.quantity;
      booking.status = 'cancelled';

      await repository.saveTier(tier);
      await repository.saveBooking(booking);

      return booking;
    },
  };
}



