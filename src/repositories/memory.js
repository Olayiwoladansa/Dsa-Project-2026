
/**
 * Build 4: In-memory repository.
 *
 * This file is responsible only for storing and retrieving data.
 * Business rules belong in the services and domain layer.
 */

export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();

  return {
    // Events
    async saveEvent(event) {
      events.set(event.id, event);
      return event;
    },

    async getEvent(eventId) {
      return events.get(eventId) ?? null;
    },

    async listEvents() {
      return [...events.values()];
    },

    // Ticket tiers
    async saveTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },

    async getTier(tierId) {
      return tiers.get(tierId) ?? null;
    },

    async listTiersByEvent(eventId) {
      return [...tiers.values()].filter(
        (tier) => tier.eventId === eventId
      );
    },

    // Bookings
    async saveBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },

    async getBooking(bookingId) {
      return bookings.get(bookingId) ?? null;
    },

    async getBookingByReference(reference) {
      return bookingsByReference.get(reference) ?? null;
    },

    async listBookings() {
      return [...bookings.values()];
    },
  };
}
