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

  const grandTotal = Number(
      cart?.prices?.grandTotalAmount ?? cart?.grandTotal ?? 0
  );

  const currency = getCurrency();

  const email =
      app?.customer?.email || cart?.email || cart?.customer?.email || '';

  const birthDate = app?.customer?.dob
      ? app.customer.dob.split('T')[0]
      : cart?.customer?.dob?.split('T')[0] ||
      window.customerData?.dob?.split('T')[0] ||
      null;

  const company = billing.company || '';
  const isB2B = !!company && company.trim() !== '';

  const customerData = {
    firstname: billing.firstname || billing.firstName || '',
    lastname: billing.lastname || billing.lastName || '',
    email: email,
    birthDate: birthDate,

    billingAddress: {
      name: `${billing.firstname || billing.firstName || ''} ${
          billing.lastname || billing.lastName || ''
      }`.trim(),
      street: Array.isArray(billing.street)
          ? billing.street.join(' ')
          : billing.street || '',
      zip: billing.postcode || billing.zipcode || billing.zip || '',
      city: billing.city || '',
      country:
          billing.country || billing.countryId || billing.country_code || '',
    },

    shippingAddress: {
      name: `${shipping.firstname || shipping.firstName || ''} ${
          shipping.lastname || shipping.lastName || ''
      }`.trim(),
      street: Array.isArray(shipping.street)
          ? shipping.street.join(' ')
          : shipping.street || '',
      zip: shipping.postcode || shipping.zipcode || shipping.zip || '',
      city: shipping.city || '',
      country:
          shipping.country || shipping.countryId || shipping.country_code || '',
    },

    customerSettings: {
      type: isB2B ? 'B2B' : 'B2C',
    },
  };

  // Add companyInfo for B2B
  if (isB2B) {
    customerData.company = billing.company;
    customerData.companyInfo = {
      companyName: company.trim(),
    };
  }

  return {
    grandTotal: Number(grandTotal),
    currency,
    email,
    billing: customerData.billingAddress,
    shipping: customerData.shippingAddress,
    customer: customerData,
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

  paymentEl.setCustomerData?.(snap.customer);
}

/**
 * Refresh unzer component with created snapshot.
 *
 * @param {HTMLElement} paymentEl   <unzer-payment>
 * @param {object} cart
 * @param {object} app
 */
export function refreshUnzerFromContexts(paymentEl, cart, app) {
  const snap = buildSnapshot(cart, app);
  console.log('[Unzer Snapshot]', JSON.parse(JSON.stringify(snap)));

  primeBasketAndCustomerData(paymentEl, snap);

  return snap;
}
