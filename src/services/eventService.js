
import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';
import { searchEvents, summarizeEvent } from '../domain/eventSearch.js';

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }

  return value.trim();
}

function requireWholeNumber(value, field, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new DomainError(
      'VALIDATION',
      `${field} must be a whole number of at least ${min}`
    );
  }

  return value;
}

export function createEventService(repository) {
  if (!repository) {
    throw new TypeError('An event repository is required');
  }

  return {
    async createEvent({ title, city, venue = '', startsAt, organizerId }) {
      const date = new Date(startsAt);

      if (Number.isNaN(date.getTime())) {
        throw new DomainError('VALIDATION', 'startsAt must be a valid date');
      }

      const event = {
        id: newId(),
        organizerId: requireText(organizerId, 'Organizer ID'),
        title: requireText(title, 'Title'),
        city: requireText(city, 'City'),
        venue: typeof venue === 'string' ? venue.trim() : '',
        startsAt: date.toISOString(),
        status: 'draft',
        tierIds: [],
      };

      return repository.saveEvent(event);
    },

    async addTier(eventId, { name, priceCents, capacity }) {
      const event = await repository.getEvent(eventId);

      if (!event) {
        throw new DomainError('NOT_FOUND', 'Event not found');
      }

      const tier = {
        id: newId(),
        eventId,
        name: requireText(name, 'Tier name'),
        priceCents: requireWholeNumber(priceCents, 'priceCents', 0),
        capacity: requireWholeNumber(capacity, 'capacity', 1),
        sold: 0,
      };

      await repository.saveTier(tier);

      event.tierIds.push(tier.id);
      await repository.saveEvent(event);

      return tier;
    },

    async publishEvent(eventId) {
      const event = await repository.getEvent(eventId);

      if (!event) {
        throw new DomainError('NOT_FOUND', 'Event not found');
      }

      const tiers = await repository.listTiersByEvent(eventId);

      if (tiers.length === 0) {
        throw new DomainError(
          'INVALID_STATE',
          'Add at least one ticket tier before publishing'
        );
      }

      event.status = 'published';
      await repository.saveEvent(event);

      return event;
    },

    async unpublishEvent(eventId) {
      const event = await repository.getEvent(eventId);

      if (!event) {
        throw new DomainError('NOT_FOUND', 'Event not found');
      }

      event.status = 'draft';
      await repository.saveEvent(event);

      return event;
    },

    async listEvents(criteria = {}, sortBy = 'date') {
      const events = (await repository.listEvents())
        .filter((event) => event.status === 'published');

      const summaries = await Promise.all(
        events.map(async (event) => {
          const tiers = await repository.listTiersByEvent(event.id);
          return summarizeEvent(event, tiers);
        })
      );

      return searchEvents(summaries, criteria, sortBy);
    },
  };
}
