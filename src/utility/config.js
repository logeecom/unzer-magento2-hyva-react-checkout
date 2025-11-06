/* eslint-disable */

/**
 * config.js — Utilities for reading Hyvä React Checkout config
 *
 * The checkout page renders a JSON blob into:
 *   <div id="react-checkout" data-checkout_config="...JSON..."></div>
 *
 * These helpers safely parse that JSON and expose convenient getters.
 */

/**
 * Safely parse JSON string.
 *
 * @param {string} str
 * @returns {any} Parsed object or {} on failure.
 */
function safeParse(str) {
  try {
    return JSON.parse(str || '{}') || {};
  } catch {
    return {};
  }
}

/**
 * Get the root element that carries the checkout config.
 *
 * @returns {HTMLElement|null}
 */
export function getCheckoutRootEl() {
  return document.getElementById('react-checkout');
}

/**
 * Read and parse the full checkout config as an object.
 *
 * @returns {object}
 */
export function getCheckoutConfig() {
  const el = getCheckoutRootEl();
  const json = el?.dataset?.checkout_config || '{}';
  return safeParse(json);
}

/**
 * Coerce various truthy values (1, "1", true, "true") to boolean true.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function toBool(v) {
  return (
    v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'
  );
}

/**
 * Safely read a nested value by path (e.g., "payment.unzer.publicKey").
 *
 * @param {object} obj
 * @param {string} path Dot-separated path
 * @param {any} [fallback]
 * @returns {any}
 */
export function getByPath(obj, path, fallback) {
  if (!obj || !path) return fallback;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = cur[p];
    } else {
      return fallback;
    }
  }
  return cur ?? fallback;
}

/**
 * Resolve a payment method code from either a string or a method object.
 *
 * @param {string|{code?: string}} methodOrCode
 * @returns {string} method code (may be empty string)
 */
export function resolveMethodCode(methodOrCode) {
  if (typeof methodOrCode === 'string') return methodOrCode;
  if (methodOrCode && typeof methodOrCode === 'object')
    return methodOrCode.code || '';
  return '';
}

/**
 * Get the config object for a specific payment method code.
 *
 * @param {string} methodCode
 * @returns {object} method-specific config ({} if missing)
 */
export function getPaymentMethodConfig(methodCode) {
  const code = resolveMethodCode(methodCode);
  const cfg = getCheckoutConfig();

  return (
    getByPath(cfg, `payment.${code}`, null) ||
    getByPath(cfg, 'payment.unzer', null) ||
    getByPath(cfg, code, {}) ||
    {}
  );
}

/**
 * Get Unzer publicKey. Priority:
 *
 * @param {string} [methodCode='unzer_cards']
 * @returns {string}
 */
export function getUnzerPublicKey(methodCode = 'unzer_cards') {
  const methodCfg = getPaymentMethodConfig(methodCode);
  const cfg = getCheckoutConfig();
  return (
    methodCfg?.publicKey || getByPath(cfg, 'payment.unzer.publicKey', '') || ''
  );
}

/**
 * Get UI/locale code. Priority:
 *
 * @returns {string}
 */
export function getLocale() {
  const cfg = getCheckoutConfig();
  return getByPath(
    cfg,
    'payment.unzer.locale',
    getByPath(cfg, 'locale', 'en-US')
  );
}

/**
 * Convenience getter for Click-to-Pay/CTP flag. Returns boolean.
 *
 * @param {string} [methodCode='unzer_cards']
 * @returns {boolean}
 */
export function getEnableClickToPay(methodCode = 'unzer_cards') {
  const methodCfg = getPaymentMethodConfig(methodCode);
  const cfg = getCheckoutConfig();
  const raw =
    methodCfg?.enable_click_to_pay ??
    getByPath(cfg, 'payment.unzer.enable_click_to_pay', false);
  return toBool(raw);
}

/**
 * Get currency used by the quote/checkout.
 */
export function getCurrency() {
  const cfg = getCheckoutConfig();
  const fromDataset = cfg?.currency;

  return fromDataset?.code || 'EUR';
}

/**
 * Generic accessor for any method-specific field.
 *
 * @param {string} methodCode
 * @param {string} path Dot path inside the method block (e.g., "foo.bar")
 * @param {any} [fallback]
 * @returns {any}
 */
export function getMethodField(methodCode, path, fallback) {
  const methodCfg = getPaymentMethodConfig(methodCode);
  return getByPath(methodCfg, path, fallback);
}
