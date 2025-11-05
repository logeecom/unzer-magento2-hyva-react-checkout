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

import { makeSubmitPromise } from '../dom/submit';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';

export default function UnzerCards({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_cards';
  const isSelected = methodCode === selected?.code;

  const { registerPaymentAction } = useCheckoutFormContext();
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage } = useAppContext();

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

  // Guard refs to prevent duplicate submissions
  const submittingRef = useRef(false);
  const inflightRef = useRef(null);
  const registeredRef = useRef(false);

  // Mount Unzer UI
  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return;

    // Clear and rebuild from scratch
    mountRef.current.innerHTML = '';

    // Create elements using helper utilities
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

    // Store references
    paymentElRef.current = unzerPaymentEl;
    checkoutElRef.current = unzerCheckoutEl;

    // Cleanup when unmounted
    return () => {
      if (mountRef.current) mountRef.current.innerHTML = '';
      paymentElRef.current = null;
      checkoutElRef.current = null;
    };
  }, [isSelected, sdkReady, publicKey, locale, enableCTP, methodCode]);

  // Register payment handler for Hyvä React Checkout
  useEffect(() => {
    if (!isSelected) {
      // Remove the handler if method is deselected
      registerPaymentAction(methodCode, undefined);
      registeredRef.current = false;
      submittingRef.current = false;
      inflightRef.current = null;
      return;
    }

    // Prevent duplicate registration
    if (registeredRef.current) return;

    const handler = async (values) => {
      // Skip if submission already in progress
      if (submittingRef.current) {
        console.warn(
          '[UnzerCards] submit in progress or stuck – skipping duplicate call.'
        );
        return false;
      }

      try {
        const checkoutEl = checkoutElRef.current;
        if (!checkoutEl) throw new Error('Unzer checkout element not ready.');

        // Validate button state before proceeding
        const unzerBtn =
          checkoutEl.shadowRoot?.querySelector('button') ||
          checkoutEl.querySelector('button');

        if (unzerBtn?.disabled) {
          setErrorMessage(
            'Please fill in all payment details before placing the order.'
          );
          return false;
        }

        setPageLoader(true);

        // Set listener before triggering the Unzer submit
        const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
        submittingRef.current = true;
        inflightRef.current = submitPromise;

        // Click the hidden submit trigger inside <unzer-checkout>
        checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

        // Wait for resourceId from Unzer SDK
        const resourceId = await submitPromise;

        // Call Magento REST API to place order
        await performPlaceOrder(
          { email: values?.login?.email || values?.email },
          { additionalData: { resource_id: resourceId } }
        );

        // Redirect to Unzer redirect endpoint
        const url = `${window.BASE_URL || '/'}unzer/payment/redirect`;
        window.location.replace(url);

        return true;
      } catch (err) {
        console.error('[UnzerCards] Unzer/payment flow failed:', err);
        setErrorMessage(
          err?.message || 'This transaction could not be performed.'
        );
        return false;
      } finally {
        submittingRef.current = false;
        inflightRef.current = null;
        setPageLoader(false);
      }
    };

    registerPaymentAction(methodCode, handler);
    registeredRef.current = true;

    // Cleanup
    return () => {
      registerPaymentAction(methodCode, undefined);
      registeredRef.current = false;
      submittingRef.current = false;
      inflightRef.current = null;
    };
  }, [
    isSelected,
    methodCode,
    registerPaymentAction,
    performPlaceOrder,
    setPageLoader,
    setErrorMessage,
  ]);

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
