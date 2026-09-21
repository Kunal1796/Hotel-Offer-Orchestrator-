'use strict';
const live = window.HOTEL_APP_MODE === 'live';
const form = document.querySelector('#search-form');
const results = document.querySelector('#results');
const summary = document.querySelector('#result-summary');
const button = document.querySelector('#search-button');
const errorMessage = document.querySelector('#error-message');
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
// Explicitly labeled preview data only. Live mode always calls the Temporal-backed API.
const samples = {
  delhi: [
    { name: 'City Inn', price: 3200, supplier: 'Supplier A', commissionPct: 8 },
    { name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 },
    { name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 },
    { name: 'Grand Palace', price: 8100, supplier: 'Supplier B', commissionPct: 18 },
  ],
  mumbai: [{ name: 'Sea View', price: 7100, supplier: 'Supplier B', commissionPct: 14 }],
};

function render(offers, city) {
  results.replaceChildren();
  summary.textContent = `${offers.length} ${live ? '' : 'sample '}offer${offers.length === 1 ? '' : 's'} in ${city.charAt(0).toUpperCase() + city.slice(1)}`;
  if (!offers.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No offers match your search. Try Delhi or Mumbai, or widen your price range.';
    results.append(empty);
    return;
  }
  for (const offer of offers) {
    const card = document.querySelector('#offer-template').content.cloneNode(true);
    card.querySelector('.offer-icon').textContent = offer.name.charAt(0);
    card.querySelector('.offer-name').textContent = offer.name;
    card.querySelector('.offer-city').textContent = `${city}, India`;
    card.querySelector('.offer-supplier').textContent = offer.supplier;
    card.querySelector('.offer-price').textContent = money.format(offer.price);
    card.querySelector('.commission').textContent = `${offer.commissionPct}% commission`;
    results.append(card);
  }
}

async function search(event) {
  event?.preventDefault();
  errorMessage.hidden = true;
  const city = document.querySelector('#city').value.trim().toLowerCase();
  const min = document.querySelector('#min-price').value;
  const max = document.querySelector('#max-price').value;
  if (!city || (min !== '' && max !== '' && Number(min) > Number(max))) {
    errorMessage.textContent = !city ? 'Enter a city to search.' : 'Minimum price must be less than or equal to maximum price.';
    errorMessage.hidden = false;
    return;
  }
  button.disabled = true;
  results.setAttribute('aria-busy', 'true');
  summary.textContent = live ? 'Comparing both suppliers…' : 'Loading sample offers…';
  try {
    let offers;
    if (live) {
      const params = new URLSearchParams({ city });
      if (min !== '') params.set('minPrice', min);
      if (max !== '') params.set('maxPrice', max);
      const response = await fetch(`./api/hotels?${params}`, { signal: AbortSignal.timeout(55000) });
      if (!response.ok) throw new Error(response.status === 400 ? 'Check the city and price range and try again.' : 'The hotel service is temporarily unavailable. Please try again shortly.');
      offers = await response.json();
    } else {
      offers = (samples[city] || []).filter(offer => (min === '' || offer.price >= Number(min)) && (max === '' || offer.price <= Number(max)));
    }
    render(offers, city);
  } catch (error) {
    results.replaceChildren();
    summary.textContent = 'Search could not be completed';
    errorMessage.textContent = error.name === 'TimeoutError' ? 'The search took too long. Please try again.' : error.message;
    errorMessage.hidden = false;
  } finally {
    button.disabled = false;
    results.setAttribute('aria-busy', 'false');
  }
}

if (live) {
  document.querySelector('#mode-badge').textContent = 'Live API';
  document.querySelector('#mode-description').textContent = 'Searches compare both mock suppliers through Temporal, with price filtering performed in Redis. Prices are in INR.';
  button.firstChild.textContent = 'Search hotels ';
}
form.addEventListener('submit', search);
search();
