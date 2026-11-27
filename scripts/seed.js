import { openDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

const database = openDatabase();
const repository = createSqliteRepository(database);

try {
  let event = await repository.getEvent('seed-event-1');

  if (!event) {
    event = {
      id: 'seed-event-1',
      organizerId: 'seed-organizer',
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: '2026-12-05T17:00:00.000Z',
      status: 'published',
      tierIds: [],
    };

    await repository.saveEvent(event);
    console.log('Created sample event.');
  } else {
    console.log('Sample event already exists.');
  }

  const existingTier = await repository.getTier('seed-tier-1');

  if (!existingTier) {
    const tier = {
      id: 'seed-tier-1',
      eventId: event.id,
      name: 'General',
      priceCents: 500000,
      capacity: 100,
      sold: 0,
    };

    await repository.saveTier(tier);

    if (!event.tierIds.includes(tier.id)) {
      event.tierIds.push(tier.id);
      await repository.saveEvent(event);
    }

    console.log('Created sample ticket tier.');
  } else {
    console.log('Sample ticket tier already exists.');
  }

  console.log('Seed completed successfully.');
} finally {
  database.close();
}
