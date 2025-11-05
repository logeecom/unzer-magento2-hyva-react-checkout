/* eslint-disable */
/**
 * createElements.js
 *
 * Helper functions for creating Unzer UI web components.
 *
 * These functions are responsible only for DOM creation — they do not depend on React,
 * Magewire, or checkout logic. Each function returns a plain HTMLElement that can be
 * mounted into the checkout container by your React component.
 */

/**
 * Creates a <unzer-payment> element configured with locale and public key,
 * and mounts the provided Unzer-specific child component inside it.
 *
 * Example usage:
 * ```js
 * const el = createUnzerPaymentEl({
 *   methodCode: 'unzer_cards',
 *   publicKey: 'pk_test_123',
 *   locale: 'en-US',
 *   enableCTP: false,
 *   paymentTag: 'unzer-card',
 * });
 * mountRef.current.appendChild(el);
 * ```
 *
 * @param {Object} params
 * @param {string} params.methodCode          - Magento/Hyvä payment method code (e.g. "unzer_cards")
 * @param {string} [params.publicKey]         - Unzer public key for <unzer-payment>
 * @param {string} [params.locale]            - Locale code, e.g. "en-US"
 * @param {boolean} [params.enableCTP=true]   - Whether Click-to-Pay should be enabled
 * @param {string} params.paymentTag          - Child component tag name (e.g. "unzer-card", "unzer-sepa", etc.)
 * @returns {HTMLElement} The configured <unzer-payment> element
 */
export function createUnzerPaymentEl({
  methodCode,
  publicKey,
  locale,
  enableCTP = true,
  paymentTag,
}) {
  const el = document.createElement('unzer-payment');
  el.id = `unzer-payment-${methodCode}`;

  if (publicKey) el.setAttribute('publicKey', publicKey);
  if (locale) el.setAttribute('locale', locale);
  if (!enableCTP) el.setAttribute('disableCTP', 'true');

  // Mount the specific Unzer child element (e.g. <unzer-card/>)
  const child = document.createElement(paymentTag);
  el.appendChild(child);

  return el;
}

/**
 * Creates a <unzer-checkout> element and appends a hidden <button type="submit">.
 *
 * The hidden submit button can later be triggered programmatically during the
 * payment validation phase to initiate Unzer’s internal submission flow.
 *
 * Example usage:
 * ```js
 * const checkoutEl = createUnzerCheckoutEl('unzer_cards');
 * mountRef.current.appendChild(checkoutEl);
 * ```
 *
 * @param {string} methodCode - Payment method code (used to build unique element IDs)
 * @returns {HTMLElement} The <unzer-checkout> element with a hidden submit button inside
 */
export function createUnzerCheckoutEl(methodCode) {
  const el = document.createElement('unzer-checkout');
  el.id = `unzer-checkout-${methodCode}`;

  const hiddenBtn = document.createElement('button');
  hiddenBtn.type = 'submit';
  hiddenBtn.id = `unzer-submit-${methodCode}`;
  hiddenBtn.style.display = 'none';
  el.appendChild(hiddenBtn);

  return el;
}
