/* eslint-disable */
import { getCurrency } from './config';

/**
 * Create basket and customer snapshot
 *
 * @param {object} cart  - useCartContext()
 * @param {object} app   - useAppContext()
 */
export function buildSnapshot(cart, app) {
  const billing = cart?.billingAddress || cart?.billing_address || {};
  const shipping = cart?.shippingAddress || cart?.shipping_address || {};

  const grandTotal = Number(cart?.prices?.grandTotalAmount ?? 0);

  const currency = getCurrency();

  const email =
    app?.customer?.email || cart?.email || cart?.customer?.email || '';

  return {
    grandTotal: Number(grandTotal),
    currency,
    email,
    billing: {
      firstname: billing.firstname || '',
      lastname: billing.lastname || '',
      street: Array.isArray(billing.street)
        ? billing.street.join(' ')
        : billing.street || '',
      postcode: billing.postcode || billing.zipcode || '',
      city: billing.city || '',
      country:
        billing.country || billing.countryId || billing.country_code || '',
    },
    shipping: {
      firstname: shipping.firstname || '',
      lastname: shipping.lastname || '',
      street: Array.isArray(shipping.street)
        ? shipping.street.join(' ')
        : shipping.street || '',
      postcode: shipping.postcode || shipping.zipcode || '',
      city: shipping.city || '',
      country:
        shipping.country || shipping.countryId || shipping.country_code || '',
    },
  };
}

/**
 * Refresh unzer component with created snapshot.
 *
 * @param {HTMLElement} paymentEl   <unzer-payment>
 * @param {object} snap
 */
export function primeBasketAndCustomerData(paymentEl, snap) {
  if (!paymentEl || !snap) return;

  paymentEl.setBasketData?.({
    amount: snap.grandTotal,
    currencyType: snap.currency,
  });

  paymentEl.setCustomerData?.({
    firstname: snap.billing.firstname,
    lastname: snap.billing.lastname,
    email: snap.email,
    birthDate: null,
    billingAddress: {
      name: `${snap.billing.firstname} ${snap.billing.lastname}`.trim(),
      street: snap.billing.street,
      zip: snap.billing.postcode,
      city: snap.billing.city,
      country: snap.billing.country,
    },
    shippingAddress: {
      name: `${snap.shipping.firstname} ${snap.shipping.lastname}`.trim(),
      street: snap.shipping.street,
      zip: snap.shipping.postcode,
      city: snap.shipping.city,
      country: snap.shipping.country,
    },
  });
}

/**
 * Refresh unzer component with created snapshot.
 *
 * @param {HTMLElement} paymentEl   <unzer-payment>
 * @param {object} snap
 */
export function refreshUnzerFromContexts(paymentEl, cart, app) {
  const snap = buildSnapshot(cart, app);
  console.log('[Unzer Snapshot]', JSON.parse(JSON.stringify(snap)));
  primeBasketAndCustomerData(paymentEl, snap);
  return snap;
}
