/* eslint-disable */
/**
 * UnzerCards (display-only)
 *
 * - Loads the Unzer UI SDK via the useUnzerSdk hook
 * - Reads configuration from Hyvä’s data-checkout_config via utility/config
 * - Mounts <unzer-payment>, <unzer-card>, and optionally <unzer-checkout> elements
 */
import React, { useEffect, useRef } from 'react';
import { shape, func } from 'prop-types';
import { paymentMethodShape } from '../../../../utils/payment';
import RadioInput from '../../../../components/common/Form/RadioInput';

import useUnzerSdk from '../hooks/useUnzerSdk';
import {
  getUnzerPublicKey,
  getLocale,
  getEnableClickToPay,
} from '../utility/config';

import {
  createUnzerPaymentEl,
  createUnzerCheckoutEl,
} from '../dom/createElements';

export default function UnzerCards({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_cards';
  const isSelected = methodCode === selected?.code;

  // Wait until Unzer SDK is ready
  const sdkReady = useUnzerSdk({
    components: ['unzer-card'],
    waitForCheckout: true,
  });

  // Read config values
  const publicKey = getUnzerPublicKey(methodCode);
  const locale = getLocale();
  const enableCTP = getEnableClickToPay(methodCode);

  // DOM refs
  const mountRef = useRef(null);
  const paymentElRef = useRef(null);
  const checkoutElRef = useRef(null);

  // Mount Unzer UI
  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return;

    // Clear and rebuild from scratch
    mountRef.current.innerHTML = '';

    // ✅ use helper functions
    const unzerPaymentEl = createUnzerPaymentEl({
      methodCode,
      publicKey,
      locale,
      enableCTP,
      paymentTag: 'unzer-card',
    });

    const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

    mountRef.current.appendChild(unzerPaymentEl);
    mountRef.current.appendChild(unzerCheckoutEl);

    // Keep refs
    paymentElRef.current = unzerPaymentEl;
    checkoutElRef.current = unzerCheckoutEl;

    // Cleanup on unmount
    return () => {
      if (mountRef.current) mountRef.current.innerHTML = '';
      paymentElRef.current = null;
      checkoutElRef.current = null;
    };
  }, [isSelected, sdkReady, publicKey, locale, enableCTP, methodCode]);

  return (
    <div>
      <RadioInput
        value={method.code}
        label={method.title}
        name="paymentMethod"
        checked={isSelected}
        onChange={actions.change}
      />

      {isSelected && (
        <div
          id={`unzer-mount-${methodCode}`}
          ref={mountRef}
          style={{
            marginTop: 12,
            display: 'grid',
            gap: '0.75rem',
            minHeight: 160,
          }}
        />
      )}

      {isSelected && (
        <label
          htmlFor="unzer-card-save-card-checkbox"
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            marginTop: '0.5rem',
          }}
        >
          <input type="checkbox" id="unzer-card-save-card-checkbox" />
          <span id="unzer-card-save-card-typography">Save for later use.</span>
        </label>
      )}
    </div>
  );
}

UnzerCards.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape.isRequired,
  actions: shape({ change: func }).isRequired,
};
