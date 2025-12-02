/* eslint-disable */
import React, { useEffect, useRef } from 'react';
import { shape, func } from 'prop-types';
import { paymentMethodShape } from '../../../../utils/payment';

import RadioInput from '../../../../components/common/Form/RadioInput';

import useUnzerSdk from '../hooks/useUnzerSdk';
import { getUnzerPublicKey, getLocale } from '../utility/config';

import {
  createUnzerPaymentEl,
  createUnzerCheckoutEl,
} from '../dom/createElements';
import { makeSubmitPromise } from '../dom/submit';

import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';

import { refreshUnzerFromContexts } from '../utility/snapshot';

export default function UnzerOpenBanking({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_open_banking';
  const isSelected = methodCode === selected?.code;

  const cartCtx = useCartContext();
  const appCtx = useAppContext();

  const { registerPaymentAction } = useCheckoutFormContext();
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage } = useAppContext();

  // Load Unzer SDK
  const sdkReady = useUnzerSdk({
    components: ['unzer-open-banking'],
    waitForCheckout: true,
  });

  // Config
  const publicKey = getUnzerPublicKey(methodCode);
  const locale = getLocale();

  // DOM refs
  const mountRef = useRef(null);
  const paymentElRef = useRef(null);
  const checkoutElRef = useRef(null);

  const submittingRef = useRef(false);
  const inflightRef = useRef(null);
  const registeredRef = useRef(false);

  /**
   * Mount Unzer Open Banking form
   */
  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return;

    const mountNode = mountRef.current;
    mountNode.innerHTML = '';

    const unzerPaymentEl = createUnzerPaymentEl({
      methodCode,
      publicKey,
      locale,
      paymentTag: 'unzer-open-banking',
    });

    const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

    mountNode.appendChild(unzerPaymentEl);
    mountNode.appendChild(unzerCheckoutEl);

    paymentElRef.current = unzerPaymentEl;
    checkoutElRef.current = unzerCheckoutEl;

    refreshUnzerFromContexts(paymentElRef.current, cartCtx.cart, appCtx);

    return () => {
      mountNode.innerHTML = '';
      paymentElRef.current = null;
      checkoutElRef.current = null;
    };
  }, [isSelected, sdkReady, publicKey, locale, methodCode]);

  /**
   * Register place-order handler
   */
  useEffect(() => {
    if (!isSelected) {
      registerPaymentAction(methodCode, undefined);
      registeredRef.current = false;
      submittingRef.current = false;
      inflightRef.current = null;
      return;
    }

    if (registeredRef.current) return;

    const handler = async (values) => {
      if (submittingRef.current) return false;

      try {
        const checkoutEl = checkoutElRef.current;
        if (!checkoutEl) {
          setErrorMessage('Payment form not ready.');
          return false;
        }

        // Validate form submit button
        const btn =
            checkoutEl.shadowRoot?.querySelector('button') ||
            checkoutEl.querySelector('button');

        if (btn?.disabled) {
          setErrorMessage('Please complete the payment details.');
          return false;
        }

        setPageLoader(true);

        const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });

        refreshUnzerFromContexts(paymentElRef.current, cartCtx.cart, appCtx);

        submittingRef.current = true;
        inflightRef.current = submitPromise;

        // Trigger Unzer submit
        checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

        // Wait for resourceId (may be null for pure redirect)
        const resourceId = await submitPromise;

        // Build payload
        const payload = {};
        if (!appCtx.isLoggedIn) {
          payload.login = {
            email: values?.login?.email || values?.email,
          };
        }

        // Send to Magento
        await performPlaceOrder(payload, {
          additionalData: {
            resource_id: resourceId || null,
          },
        });

        // Redirect to Unzer
        window.location.replace(
            `${window.BASE_URL || '/'}unzer/payment/redirect`
        );

        return true;
      } catch (err) {
        console.error('[UnzerOpenBanking] Error:', err);
        setErrorMessage(
            err?.message || 'Unable to process Open Banking payment.'
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

  /**
   * Render
   */
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
      </div>
  );
}

UnzerOpenBanking.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape.isRequired,
  actions: shape({ change: func }).isRequired,
};
