
import { listEvents } from '../api.js';
import { el, formatMoney } from '../ui.js';

const form = document.querySelector('#filter-form');
const eventList = document.querySelector('#event-list');
const message = document.querySelector('#event-message');

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString));
}

function createEventCard(event) {
  return el('article', {
    className: 'event-card',
  }, [
    el('h3', { text: event.title }),
    el('p', { text: `${event.city} · ${event.venue}` }),
    el('p', { text: formatDate(event.startsAt) }),
    el('p', {
      text: event.minPriceCents === null
        ? 'No ticket tiers available'
        : `From ${formatMoney(event.minPriceCents)}`,
    }),
    el('p', {
      text: `${event.seatsLeft} seat(s) available`,
    }),
    el('a', {
      className: 'button',
      href: `/event.html?id=${encodeURIComponent(event.id)}`,
      text: 'View event',
    }),
  ]);
}

async function loadEvents(criteria = {}) {
  message.textContent = 'Loading events...';
  eventList.replaceChildren();

  try {
    const result = await listEvents(criteria);

    if (result.events.length === 0) {
      message.textContent = 'No events match your filters.';
      return;
    }

    message.textContent = `${result.events.length} event(s) found.`;

    for (const event of result.events) {
      eventList.append(createEventCard(event));
    }
  } catch (error) {
    message.textContent = error.message || 'Could not load events.';
  }
}

function getFilters() {
  const formData = new FormData(form);
  const search = formData.get('search').trim();
  const city = formData.get('city');
  const maxPrice = formData.get('maxPrice');
  const sort = formData.get('sort');
  const onlyAvailable = formData.get('onlyAvailable') === 'true';

  const criteria = { sort };

  if (search) criteria.q = search;
  if (city) criteria.city = city;

  if (maxPrice !== '') {
    const naira = Number(maxPrice);

    if (!Number.isFinite(naira) || naira < 0) {
      throw new Error('Enter a valid maximum price.');
    }

    criteria.maxPriceCents = Math.round(naira * 100);
  }

  if (onlyAvailable) {
    criteria.onlyAvailable = true;
  }

  return criteria;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    loadEvents(getFilters());
  } catch (error) {
    message.textContent = error.message;
  }
});

form.addEventListener('reset', () => {
  setTimeout(() => loadEvents(), 0);
});

loadEvents();
