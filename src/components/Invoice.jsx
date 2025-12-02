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

import { buildSnapshot, refreshUnzerFromContexts } from '../utility/snapshot';

/**
 * Unzer Paylater Invoice B2B for Hyvä React Checkout
 */
export default function UnzerInvoiceB2B({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_paylater_invoice_b2b';
  const isSelected = methodCode === selected?.code;

  const cartCtx = useCartContext();
  const appCtx = useAppContext();

  const { registerPaymentAction } = useCheckoutFormContext();
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage } = useAppContext();

  // Load Unzer SDK
  const sdkReady = useUnzerSdk({
    components: ['unzer-paylater-invoice'],
    waitForCheckout: true,
  });

  const publicKey = getUnzerPublicKey(methodCode);
  const locale = getLocale();

  // DOM refs
  const mountRef = useRef(null);
  const paymentElRef = useRef(null);
  const checkoutElRef = useRef(null);

  // Guards
  const submittingRef = useRef(false);
  const registeredRef = useRef(false);

  /**
   * Mount <unzer-payment> + <unzer-paylater-invoice> + <unzer-checkout>
   */
  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return;

    const mountNode = mountRef.current;
    mountNode.innerHTML = '';

    const unzerPaymentEl = createUnzerPaymentEl({
      methodCode,
      publicKey,
      locale,
      paymentTag: 'unzer-paylater-invoice',
    });

    const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

    mountNode.appendChild(unzerPaymentEl);
    mountNode.appendChild(unzerCheckoutEl);

    paymentElRef.current = unzerPaymentEl;
    checkoutElRef.current = unzerCheckoutEl;

    // Fill snapshot (customer + basket)
    try {
      refreshUnzerFromContexts(unzerPaymentEl, cartCtx.cart, appCtx);
    } catch (e) {
      console.warn('[UnzerInvoiceB2B] Snapshot error:', e);
    }

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
      submittingRef.current = false;
      registeredRef.current = false;
      return;
    }

    if (registeredRef.current) return;

    const handler = async (values) => {
      if (submittingRef.current) return false;

      try {
        const checkoutEl = checkoutElRef.current;
        const paymentEl = paymentElRef.current;

        if (!checkoutEl || !paymentEl) {
          setErrorMessage('Invoice B2B form not ready.');
          return false;
        }

        // Validate Unzer UI state
        const btn =
            checkoutEl.shadowRoot?.querySelector('button') ||
            checkoutEl.querySelector('button');

        if (btn?.disabled) {
          setErrorMessage('Please complete all invoice details.');
          return false;
        }

        setPageLoader(true);
        submittingRef.current = true;

        const submitPromise = new Promise((resolve, reject) => {
          checkoutEl.onPaymentSubmit = async (resp) => {
            try {
              console.log('[Invoice B2B] resp:', resp);

              const ok =
                  resp?.submitResponse?.success ||
                  resp?.submitResponse?.status === 'SUCCESS';

              if (!ok) {
                const msg =
                    resp?.submitResponse?.message ||
                    resp?.submitResponse?.details?.customerMessage ||
                    'Payment failed';
                setErrorMessage(msg);
                return reject(new Error(msg));
              }

              const resourceId = resp?.submitResponse?.data?.id || null;
              const customerId = resp?.customerResponse?.data?.id || null;
              const threatMetrixId = resp?.threatMetrixId || null;

              if (!resourceId) {
                const msg = 'Missing resourceId from Unzer response';
                setErrorMessage(msg);
                return reject(new Error(msg));
              }

              resolve({ resourceId, customerId, threatMetrixId });
            } catch (e) {
              reject(e);
            } finally {
              checkoutEl.onPaymentSubmit = null;
            }
          };
        });

        checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

        const { resourceId, customerId, threatMetrixId } = await submitPromise;

        const snapshot = buildSnapshot(cartCtx?.cart, appCtx);
        const birthDate = snapshot.customer?.birthDate || null;

        const payload = appCtx.isLoggedIn
            ? {}
            : { login: { email: values?.login?.email || values?.email } };

        const additionalData = {
          resource_id: resourceId,
          customer_id: customerId || null,
          birthDate,
          customer_type: 'b2b',
          threat_metrix_id: threatMetrixId || null,
        };

        console.log('[UnzerInvoiceB2B] additionalData:', additionalData);

        await performPlaceOrder(payload, { additionalData });

        // Redirect to Unzer redirect action
        window.location.href = `${
            window.BASE_URL || '/'
        }unzer/payment/redirect`;

        return true;
      } catch (err) {
        console.error('[UnzerInvoiceB2B] Error:', err);
        setErrorMessage(
            err?.message || 'Unable to process Invoice B2B payment.'
        );
        return false;
      } finally {
        submittingRef.current = false;
        setPageLoader(false);
      }
    };

    registerPaymentAction(methodCode, handler);
    registeredRef.current = true;

    return () => {
      registerPaymentAction(methodCode, undefined);
      registeredRef.current = false;
      submittingRef.current = false;
    };
  }, [isSelected]);

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

UnzerInvoiceB2B.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape.isRequired,
  actions: shape({ change: func }).isRequired,
};
