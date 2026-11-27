
import {
  getEvent,
  createBooking,
  pay,
} from '../api.js';

import { el, formatMoney } from '../ui.js';

const eventDetails = document.querySelector('#event-details');
const ticketList = document.querySelector('#ticket-list');
const checkoutSection = document.querySelector('#checkout-section');
const checkoutDetails = document.querySelector('#checkout-details');
const countdown = document.querySelector('#countdown');
const paymentForm = document.querySelector('#payment-form');
const paymentMessage = document.querySelector('#payment-message');
const payButton = document.querySelector('#pay-button');

const eventId = new URLSearchParams(window.location.search).get('id');

let currentEvent;
let currentBooking;
let countdownTimer;

function showMessage(container, text, className = '') {
  container.replaceChildren(
    el('p', { className, text })
  );
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(dateString));
}

function renderTier(tier) {
  const seatsLeft = tier.capacity - tier.sold;
  const soldOut = seatsLeft <= 0;

  const quantity = el('input', {
    id: `quantity-${tier.id}`,
    type: 'number',
    min: '1',
    max: String(Math.min(10, seatsLeft)),
    value: '1',
    disabled: soldOut,
    required: true,
  });

  const label = el('label', {
    htmlFor: quantity.id,
    text: 'Number of tickets',
  });

  const button = el('button', {
    type: 'button',
    text: soldOut ? 'Sold out' : 'Book tickets',
    disabled: soldOut,
    onClick: () => bookTier(tier.id, quantity.value),
  });

  return el('article', {
    className: 'event-card',
  }, [
    el('h3', { text: tier.name }),
    el('p', { text: formatMoney(tier.priceCents) }),
    el('p', {
      className: soldOut ? 'sold-out' : '',
      text: soldOut ? 'Sold out' : `${seatsLeft} seat(s) left`,
    }),
    label,
    quantity,
    button,
  ]);
}

async function loadEvent() {
  if (!eventId) {
    showMessage(eventDetails, 'No event was selected.', 'error');
    ticketList.replaceChildren();
    return;
  }

  try {
    currentEvent = await getEvent(eventId);

    eventDetails.replaceChildren(
      el('h2', { text: currentEvent.title }),
      el('p', {
        text: `${currentEvent.city} · ${currentEvent.venue}`,
      }),
      el('p', { text: formatDate(currentEvent.startsAt) })
    );

    ticketList.replaceChildren(
      ...currentEvent.tiers.map(renderTier)
    );

    if (currentEvent.tiers.length === 0) {
      showMessage(ticketList, 'No ticket tiers are available.');
    }
  } catch (error) {
    showMessage(
      eventDetails,
      error.message || 'Could not load this event.',
      'error'
    );
    ticketList.replaceChildren();
  }
}

async function bookTier(tierId, quantityValue) {
  const quantity = Number(quantityValue);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10
  ) {
    showMessage(
      paymentMessage,
      'Choose between 1 and 10 tickets.',
      'error'
    );
    return;
  }

  const tier = currentEvent.tiers.find(
    (item) => item.id === tierId
  );

  if (!tier) return;

  const seatsLeft = tier.capacity - tier.sold;

  if (quantity > seatsLeft) {
    showMessage(
      paymentMessage,
      `Only ${seatsLeft} ticket(s) are available.`,
      'error'
    );
    return;
  }

  try {
    const booking = await createBooking({
      eventId: currentEvent.id,
      tierId,
      quantity,
    });

    currentBooking = booking;

    const expiresAt = Date.parse(booking.expiresAt);

    checkoutDetails.replaceChildren(
      el('p', { text: `Booking reference: ${booking.reference}` }),
      el('p', { text: `Tickets: ${booking.quantity}` }),
      el('p', { text: `Total: ${formatMoney(booking.amountCents)}` })
    );

    checkoutSection.hidden = false;
    paymentForm.reset();
    payButton.disabled = false;
    showMessage(paymentMessage, '');

    startCountdown(expiresAt);
    await loadEvent();
  } catch (error) {
    showMessage(
      paymentMessage,
      error.message || 'Could not create booking.',
      'error'
    );
    await loadEvent();
  }
}

function startCountdown(expiresAt) {
  clearInterval(countdownTimer);

  function updateCountdown() {
    const remaining = Math.max(
      0,
      Math.ceil((expiresAt - Date.now()) / 1000)
    );

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    countdown.textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (remaining <= 0) {
      clearInterval(countdownTimer);
      payButton.disabled = true;
      showMessage(
        paymentMessage,
        'Your ticket hold has expired. Please book again.',
        'error'
      );
      currentBooking = null;
    }
  }

  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentBooking) {
    showMessage(
      paymentMessage,
      'Please create a booking before paying.',
      'error'
    );
    return;
  }

  const cardNumber = paymentForm.elements.cardNumber.value.trim();

  if (!cardNumber) {
    showMessage(paymentMessage, 'Enter the mock card number.', 'error');
    return;
  }

  if (Date.parse(currentBooking.expiresAt) <= Date.now()) {
    showMessage(
      paymentMessage,
      'Your ticket hold has expired. Please book again.',
      'error'
    );
    currentBooking = null;
    payButton.disabled = true;
    return;
  }

  payButton.disabled = true;
  showMessage(paymentMessage, 'Processing mock payment...');

  const outcome = cardNumber === '4000000000000002'
    ? 'declined'
    : 'approved';

  try {
    const result = await pay(currentBooking.reference, outcome);

    clearInterval(countdownTimer);
    currentBooking = null;

    countdown.textContent = 'Paid';
    showMessage(
      paymentMessage,
      `Payment successful! Booking ${result.reference} is confirmed.`,
      'success'
    );

    payButton.disabled = true;
    paymentForm.reset();
    await loadEvent();
  } catch (error) {
    showMessage(
      paymentMessage,
      error.message || 'Payment failed. Please try again.',
      'error'
    );

    payButton.disabled = false;
  }
});

loadEvent();
