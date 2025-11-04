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

export default function UnzerCards({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_cards';
  const isSelected = methodCode === selected?.code;

  // Wait until Unzer web components are registered (cards + checkout)
  const sdkReady = useUnzerSdk({
    components: ['unzer-card'],
    waitForCheckout: true,
  });

  // Read configuration from Hyvä checkout config
  const publicKey = getUnzerPublicKey(methodCode);
  const locale = getLocale();
  const enableCTP = getEnableClickToPay(methodCode); // true/false

  const mountRef = useRef(null);
  const paymentElRef = useRef(null);
  const checkoutElRef = useRef(null);

  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return;

    // Clear the container and mount components from scratch
    mountRef.current.innerHTML = '';

    // <unzer-payment>
    const up = document.createElement('unzer-payment');
    up.id = `unzer-payment-${methodCode}`;
    if (publicKey) up.setAttribute('publicKey', publicKey);
    if (locale) up.setAttribute('locale', locale);
    if (!enableCTP) up.setAttribute('disableCTP', 'true');

    // <unzer-card>
    const cardEl = document.createElement('unzer-card');
    up.appendChild(cardEl);

    // (optional) <unzer-checkout> + hidden submit
    const checkout = document.createElement('unzer-checkout');
    checkout.id = `unzer-checkout-${methodCode}`;
    const hiddenBtn = document.createElement('button');
    hiddenBtn.type = 'submit';
    hiddenBtn.id = `unzer-submit-${methodCode}`;
    hiddenBtn.style.display = 'none';
    checkout.appendChild(hiddenBtn);

    // Append elements to the DOM
    mountRef.current.appendChild(up);
    mountRef.current.appendChild(checkout);

    // Keep element references for later use
    paymentElRef.current = up;
    checkoutElRef.current = checkout;

    // Cleanup when the component unmounts
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
