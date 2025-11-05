/* eslint-disable */
/**
 * Turns Unzer's onPaymentSubmit callback into a Promise.
 * Stores the resourceId in a hidden input field for Magento to read from payment[additional_data].
 *
 * @param {HTMLElement} unzerCheckoutEl - The <unzer-checkout> element
 * @param {Object} options
 * @param {string} options.methodCode - Magento payment method code (used for unique input id)
 * @returns {Promise<boolean>} Resolves true if successful, rejects on error
 */

export function makeSubmitPromise(unzerCheckoutEl, { methodCode }) {
  return new Promise((resolve, reject) => {
    if (!unzerCheckoutEl) {
      reject(new Error('Unzer checkout element missing.'));
      return;
    }

    unzerCheckoutEl.onPaymentSubmit = async (resp) => {
      try {
        const ok =
          resp?.submitResponse?.success ||
          resp?.submitResponse?.status === 'SUCCESS';

        if (!ok) {
          const msg =
            resp?.submitResponse?.message ||
            resp?.submitResponse?.details?.customerMessage ||
            'Payment failed';
          reject(new Error(msg));
          return;
        }

        const resourceId = resp?.submitResponse?.data?.id;
        if (!resourceId) {
          reject(new Error('Missing resourceId'));
          return;
        }

        // ✅ Resolve directly with the resource id
        resolve(resourceId);
      } catch (e) {
        reject(e);
      }
    };
  });
}
