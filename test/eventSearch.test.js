
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  bookTickets,
  listEventSummaries,
} from '../src/domain/inventory.js';
import { filterEvents, sortEvents, searchEvents } from '../src/domain/eventSearch.js';
import { DomainError } from '../src/domain/errors.js';

const titles = (events) => events.map((e) => e.title);

describe('event search', () => {
  let summaries;

  before(() => {
    const store = createStore();

    const make = (title, city, startsAt, tiers, { publish = true } = {}) => {
      const event = createEvent(store, {
        title,
        city,
        venue: `${city} Hall`,
        startsAt,
        organizerId: 'org',
      });

      const created = tiers.map((tier) => addTier(store, event.id, tier));

      if (publish) publishEvent(store, event.id);

      return { event, created };
    };

    make('Jazz Night', 'Lagos', '2026-12-10T19:00:00Z', [
      { name: 'GA', priceCents: 3000, capacity: 50 },
    ]);

    make('Tech Summit', 'Abuja', '2026-12-05T09:00:00Z', [
      { name: 'GA', priceCents: 10000, capacity: 100 },
      { name: 'VIP', priceCents: 25000, capacity: 10 },
    ]);

    make('Food Fair', 'Lagos', '2026-12-05T12:00:00Z', [
      { name: 'Entry', priceCents: 0, capacity: 500 },
    ]);

    const sold = make('Sold Out Gig', 'Ibadan', '2026-12-20T20:00:00Z', [
      { name: 'GA', priceCents: 5000, capacity: 2 },
    ]);

    bookTickets(store, sold.created[0].id, 'u1', 2);

    make(
      'Secret Draft',
      'Lagos',
      '2026-12-01T10:00:00Z',
      [{ name: 'GA', priceCents: 100, capacity: 5 }],
      { publish: false },
    );

    summaries = listEventSummaries(store);
  });

  it('hides drafts from the public list', () => {
    assert.equal(summaries.length, 4);
    assert.ok(!titles(summaries).includes('Secret Draft'));
  });

  it('summarises price and seats across tiers', () => {
    const summit = summaries.find((event) => event.title === 'Tech Summit');

    assert.equal(summit.minPriceCents, 10000);
    assert.equal(summit.seatsLeft, 110);
  });

  describe('filtering', () => {
    it('filters by city, ignoring case', () => {
      assert.deepEqual(
        titles(filterEvents(summaries, { city: 'lagos' })).sort(),
        ['Food Fair', 'Jazz Night'],
      );
    });

    it('filters by text in the title or venue', () => {
      assert.deepEqual(
        titles(filterEvents(summaries, { q: 'summit' })),
        ['Tech Summit'],
      );

      assert.deepEqual(
        titles(filterEvents(summaries, { q: 'ibadan hall' })),
        ['Sold Out Gig'],
      );
    });

    it('filters by maximum price, including free events', () => {
      assert.deepEqual(
        titles(filterEvents(summaries, { maxPriceCents: 3000 })).sort(),
        ['Food Fair', 'Jazz Night'],
      );

      assert.deepEqual(
        titles(filterEvents(summaries, { maxPriceCents: 0 })),
        ['Food Fair'],
      );
    });

    it('excludes events without ticket tiers from price filtering', () => {
      const eventsWithoutPrice = [
        {
          id: 'event-1',
          title: 'No Tier Event',
          city: 'Lagos',
          venue: 'Lagos Hall',
          startsAt: '2026-12-05T10:00:00Z',
          minPriceCents: null,
          seatsLeft: 0,
        },
        {
          id: 'event-2',
          title: 'Free Event',
          city: 'Lagos',
          venue: 'Lagos Hall',
          startsAt: '2026-12-06T10:00:00Z',
          minPriceCents: 0,
          seatsLeft: 10,
        },
      ];

      assert.deepEqual(
        titles(filterEvents(eventsWithoutPrice, { maxPriceCents: 0 })),
        ['Free Event'],
      );
    });

    it('filters by date range, including the whole date in a date-only upper bound', () => {
      const result = filterEvents(summaries, {
        from: '2026-12-05',
        to: '2026-12-05',
      });

      assert.deepEqual(
        titles(result).sort(),
        ['Food Fair', 'Tech Summit'],
      );
    });

    it('can hide sold-out events', () => {
      assert.ok(
        !titles(filterEvents(summaries, { onlyAvailable: true })).includes('Sold Out Gig'),
      );
    });

    it('does not change the original list when filtering', () => {
      const original = [...summaries];

      filterEvents(summaries, { city: 'Lagos' });

      assert.deepEqual(summaries, original);
    });

    it('rejects invalid dates and invalid maximum prices', () => {
      assert.throws(
        () => filterEvents(summaries, { from: 'yesterday-ish' }),
        (error) => error instanceof DomainError && error.code === 'VALIDATION',
      );

      assert.throws(
        () => filterEvents(summaries, { to: 'not-a-date' }),
        (error) => error instanceof DomainError && error.code === 'VALIDATION',
      );

      for (const badPrice of [-5, 10.5, '100']) {
        assert.throws(
          () => filterEvents(summaries, { maxPriceCents: badPrice }),
          (error) => error instanceof DomainError && error.code === 'VALIDATION',
        );
      }
    });

    it('handles an empty list', () => {
      assert.deepEqual(filterEvents([]), []);
    });
  });

  describe('sorting', () => {
    it('sorts by date by default, earliest first', () => {
      assert.deepEqual(
        titles(sortEvents(summaries)),
        ['Tech Summit', 'Food Fair', 'Jazz Night', 'Sold Out Gig'],
      );
    });

    it('sorts by price, cheapest first', () => {
      assert.deepEqual(
        titles(sortEvents(summaries, 'price')),
        ['Food Fair', 'Jazz Night', 'Sold Out Gig', 'Tech Summit'],
      );
    });

    it('sorts by availability, most seats first', () => {
      assert.deepEqual(
        titles(sortEvents(summaries, 'availability')),
        ['Food Fair', 'Tech Summit', 'Jazz Night', 'Sold Out Gig'],
      );
    });

    it('does not change the original list when sorting', () => {
      const original = [...summaries];

      sortEvents(summaries, 'price');

      assert.deepEqual(summaries, original);
    });

    it('rejects an unknown sort key with VALIDATION', () => {
      assert.throws(
        () => sortEvents(summaries, 'constructor'),
        (error) => error instanceof DomainError && error.code === 'VALIDATION',
      );
    });

    it('handles an empty list', () => {
      assert.deepEqual(sortEvents([]), []);
    });
  });

  describe('searchEvents', () => {
    it('filters first and then sorts', () => {
      const result = searchEvents(summaries, { city: 'Lagos' }, 'price');

      assert.deepEqual(titles(result), ['Food Fair', 'Jazz Night']);
    });

    it('handles an empty list', () => {
      assert.deepEqual(searchEvents([]), []);
    });
  });
});
