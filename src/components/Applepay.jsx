/* eslint-disable */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { shape, func } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import { paymentMethodShape } from '../../../../utils/payment';

import useUnzerSdk from '../hooks/useUnzerSdk';
import {
  getUnzerPublicKey,
  getLocale,
  getCheckoutConfig,
} from '../utility/config';

import {
  createUnzerPaymentEl,
  createUnzerCheckoutEl,
} from '../dom/createElements';

import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import { refreshUnzerFromContexts } from '../utility/snapshot';

export default function UnzerApplePay({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_applepayv2';
  const isSelected = methodCode === selected?.code;

  const cfg = getCheckoutConfig();
  const applePayCfg = cfg.payment[methodCode];

  const { registerPaymentAction } = useCheckoutFormContext();
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);

  const cartCtx = useCartContext();
  const appCtx = useAppContext();
  const { setErrorMessage, setPageLoader } = appCtx;

  const sdkReady = useUnzerSdk({
    components: ['unzer-apple-pay'],
    waitForCheckout: true,
  });

  const publicKey = getUnzerPublicKey(methodCode);
  const locale = getLocale();

  // DOM refs
  const mountRef = useRef(null);
  const paymentElRef = useRef(null);
  const checkoutElRef = useRef(null);

  const submittingRef = useRef(false);
  const registeredRef = useRef(false);

  const resourceIdRef = useRef(null);
  const customerIdRef = useRef(null);
  const threatMetrixIdRef = useRef(null);

  const [appleAvailable, setAppleAvailable] = useState(true);

  // Apple Pay availability check
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const available =
            window.ApplePaySession && window.ApplePaySession.canMakePayments();
        setAppleAvailable(!!available);
        console.log('[Unzer ApplePay] Apple Pay available:', !!available);
      }
    } catch (e) {
      console.warn('[Unzer ApplePay] Apple Pay availability check failed:', e);
      setAppleAvailable(false);
    }
  }, []);

  // Place order
  const handlePlaceOrder = useCallback(
      async (resourceId, values = {}) => {
        if (submittingRef.current) {
          console.log('[Unzer ApplePay] Already submitting, skipping...');
          return false;
        }

        try {
          console.log(
              '[Unzer ApplePay] Placing order with resourceId:',
              resourceId
          );
          setPageLoader(true);
          submittingRef.current = true;

          const payload = {};
          if (!appCtx.isLoggedIn) {
            payload.login = {
              email: values?.login?.email || values?.email,
            };
          }

          // Additional data
          const additionalData = {
            resource_id: resourceId,
          };

          if (customerIdRef.current) {
            additionalData.customer_id = customerIdRef.current;
          }

          if (threatMetrixIdRef.current) {
            additionalData.threat_metrix_id = threatMetrixIdRef.current;
          }

          const billing =
              cartCtx.cart?.billing_address || cartCtx.cart?.billingAddress;

          additionalData.customer_type =
              billing?.company && billing.company.trim() !== '' ? 'B2B' : 'B2C';

          console.log(
              '[Unzer ApplePay] Placing order with data:',
              additionalData
          );

          const response = await performPlaceOrder(payload, {
            additionalData,
          });

          console.log('[Unzer ApplePay] Order response:', response);

          const redirectUrl =
              response?.redirect_url ||
              response?.response?.redirect_url ||
              `${window.BASE_URL || '/'}unzer/payment/redirect`;

          console.log('[Unzer ApplePay] Redirecting to:', redirectUrl);
          window.location.href = redirectUrl;

          return true;
        } catch (err) {
          console.error('[Unzer ApplePay] Payment error:', err);
          setErrorMessage(err?.message || 'Unable to process Apple Pay payment.');
          return false;
        } finally {
          submittingRef.current = false;
          setPageLoader(false);
        }
      },
      [
        performPlaceOrder,
        setPageLoader,
        setErrorMessage,
        appCtx.isLoggedIn,
        cartCtx.cart,
      ]
  );

  // Configure Apple Pay data on <unzer-payment>
  const setApplePayData = useCallback(
      async (maxRetries = 10, interval = 500) => {
        return new Promise((resolve, reject) => {
          let retries = 0;

          const trySetData = () => {
            const unzerPaymentEl = document.querySelector(
                `#unzer-payment-${methodCode}`
            );

            if (
                unzerPaymentEl &&
                typeof unzerPaymentEl.setApplePayData === 'function'
            ) {
              const totals = cartCtx.cart?.prices;
              const amount = totals?.grandTotalAmount ?? 0;

              const billing =
                  cartCtx.cart?.billing_address || cartCtx.cart?.billingAddress;
              const countryCode = billing?.country || 'DE';

              const currencyCode = cfg.currency.code;

              const supportedNetworks = (
                  applePayCfg?.supportedNetworks || []
              ).map((n) => String(n).toLowerCase());

              const merchantCapabilities = applePayCfg?.merchantCapabilities || [
                'supports3DS',
              ];

              const label = applePayCfg?.label || cfg.store?.name || 'Apple Pay';

              const totalAmount = Number(amount).toFixed(2);

              const applePayPaymentRequest = {
                countryCode,
                currencyCode,
                totalLabel: label,
                totalAmount,
                supportedNetworks,
                merchantCapabilities,
                requiredShippingContactFields: [],
                requiredBillingContactFields: [],
                total: {
                  label,
                  amount: totalAmount,
                },
              };

              console.log(
                  '[Unzer ApplePay] Setting Apple Pay data:',
                  applePayPaymentRequest
              );

              unzerPaymentEl.setApplePayData(applePayPaymentRequest);
              console.log('[Unzer ApplePay] Apple Pay data set successfully');
              resolve(true);
            } else if (retries < maxRetries) {
              retries++;
              console.warn(
                  `[Unzer ApplePay] setApplePayData not ready → retrying... (${retries}/${maxRetries})`
              );
              setTimeout(trySetData, interval);
            } else {
              console.error(
                  '[Unzer ApplePay] Failed to set Apple Pay data after multiple retries'
              );
              reject(new Error('Apple Pay element not ready'));
            }
          };

          trySetData();
        });
      },
      [cartCtx.cart, cfg, applePayCfg, methodCode]
  );

  // Mount Unzer elements
  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return () => {};
    if (!appleAvailable) {
      console.warn('[Unzer ApplePay] Apple Pay not available.');
      return () => {};
    }

    const mountNode = mountRef.current;
    mountNode.innerHTML = '';

    resourceIdRef.current = null;
    customerIdRef.current = null;
    threatMetrixIdRef.current = null;

    const unzerPaymentEl = createUnzerPaymentEl({
      methodCode,
      publicKey,
      locale,
      paymentTag: 'unzer-apple-pay',
    });

    const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

    unzerCheckoutEl.onPaymentSubmit = async (response) => {
      console.log('[Unzer ApplePay] onPaymentSubmit called:', response);

      if (response.customerResponse?.success) {
        customerIdRef.current = response.customerResponse.data.id;
        console.log('[Unzer ApplePay] Customer ID:', customerIdRef.current);
      }

      if (response.threatMetrixId) {
        threatMetrixIdRef.current = response.threatMetrixId;
        console.log(
            '[Unzer ApplePay] ThreatMetrix ID:',
            threatMetrixIdRef.current
        );
      }

      if (response.submitResponse?.success) {
        const resourceId = response.submitResponse.data.id;
        console.log(
            '[Unzer ApplePay] Payment successful, resourceId:',
            resourceId
        );

        resourceIdRef.current = resourceId;
        unzerCheckoutEl.dataset.resourceId = resourceId;

        try {
          const success = await handlePlaceOrder(resourceId);
          if (success) {
            return { status: 'success' };
          }
          return { status: 'error', message: 'Failed to place order' };
        } catch (error) {
          console.error('[Unzer ApplePay] Error in onPaymentSubmit:', error);
          return { status: 'error', message: error.message };
        }
      }

      console.error('[Unzer ApplePay] Payment submission failed:', response);
      return {
        status: 'error',
        message:
            response.submitResponse?.message ||
            'Apple Pay payment authorization failed',
      };
    };

    mountNode.appendChild(unzerPaymentEl);
    mountNode.appendChild(unzerCheckoutEl);

    paymentElRef.current = unzerPaymentEl;
    checkoutElRef.current = unzerCheckoutEl;

    refreshUnzerFromContexts(unzerPaymentEl, cartCtx?.cart, appCtx);

    const initializeApplePay = async () => {
      try {
        console.log(
            '[Unzer ApplePay] Waiting for custom element to be defined...'
        );

        await customElements.whenDefined('unzer-apple-pay');

        console.log(
            '[Unzer ApplePay] Custom element defined, setting Apple Pay data...'
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        await setApplePayData();

        console.log('[Unzer ApplePay] Apple Pay initialization complete');
      } catch (error) {
        console.error(
            '[Unzer ApplePay] Failed to initialize Apple Pay:',
            error
        );
        setErrorMessage(
            'Failed to initialize Apple Pay. Please try again or use another payment method.'
        );
      }
    };

    initializeApplePay();

    return () => {
      mountNode.innerHTML = '';
      paymentElRef.current = null;
      checkoutElRef.current = null;
    };
  }, [
    isSelected,
    sdkReady,
    appleAvailable,
    publicKey,
    locale,
    methodCode,
    cartCtx?.cart,
    appCtx,
    setApplePayData,
    setErrorMessage,
    handlePlaceOrder,
  ]);

  // Register Hyvä place-order handler
  useEffect(() => {
    if (!isSelected) {
      registerPaymentAction(methodCode, undefined);
      submittingRef.current = false;
      registeredRef.current = false;
      return;
    }

    if (registeredRef.current) return;

    const handler = async () => {
      console.log(
          '[Unzer ApplePay] Hyvä place order called - Apple Pay handles this internally via onPaymentSubmit'
      );
      // return false to prevent default Hyvä submission
      return false;
    };

    registerPaymentAction(methodCode, handler);
    registeredRef.current = true;
    console.log(
        '[Unzer ApplePay] Payment handler registered (Apple Pay internal flow)'
    );
  }, [isSelected, methodCode, registerPaymentAction]);

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
            <>
              {!appleAvailable && (
                  <p style={{ marginTop: 8, color: 'red' }}>
                    Apple Pay is not available.
                  </p>
              )}

              <div
                  id={`unzer-mount-${methodCode}`}
                  ref={mountRef}
                  style={{
                    marginTop: 12,
                    display: 'grid',
                    gap: '1rem',
                    minHeight: 160,
                    position: 'relative',
                  }}
              />
            </>
        )}
      </div>
  );
}

UnzerApplePay.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape.isRequired,
  actions: shape({ change: func }).isRequired,
};
