/* eslint-disable */
import React, { useEffect, useRef, useCallback } from 'react';

import useUnzerSdk from '../hooks/useUnzerSdk';
import useUnzerPerformPlaceOrder from '../hooks/useUnzerPlaceOrder';
import useHidePlaceOrderForWalletMethods from '../hooks/useHidePlaceOrderButton';
import { getUnzerPublicKey, getLocale } from '../utility/config';

import {
  createUnzerPaymentEl,
  createUnzerCheckoutEl,
} from '../dom/createElements';

import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import { refreshUnzerFromContexts, buildSnapshot } from '../utility/snapshot';

/**
 * Base component for Unzer wallet payment methods (Google Pay, Apple Pay)
 */
export default function BaseUnzerWallet({
                                          methodCode,
                                          isSelected,
                                          paymentTag,
                                          customElementName,
                                          onConfigurePaymentData,
                                          onBeforeMount,
                                        }) {
  useHidePlaceOrderForWalletMethods(isSelected, methodCode);

  const { registerPaymentAction } = useCheckoutFormContext();
  const performPlaceOrder = useUnzerPerformPlaceOrder(methodCode);

  const cartCtx = useCartContext();
  const appCtx = useAppContext();
  const { setErrorMessage, setPageLoader } = appCtx;

  const sdkReady = useUnzerSdk({
    components: [paymentTag],
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

  // Place order function
  const handlePlaceOrder = useCallback(
      async (resourceId, values = {}) => {
        if (submittingRef.current) {
          console.log(`[${methodCode}] Already submitting, skipping...`);
          return false;
        }

        try {
          console.log(
              `[${methodCode}] Placing order with resourceId:`,
              resourceId
          );
          setPageLoader(true);
          submittingRef.current = true;

          // Prepare payload
          const payload = {};
          if (!appCtx.isLoggedIn) {
            payload.login = {
              email: cartCtx?.cart?.email,
            };
          }

          // Build additional data using snapshot
          const snap = buildSnapshot(cartCtx.cart, appCtx);

          const additionalData = {
            resource_id: resourceId,
          };

          // Add customer data if available
          if (customerIdRef.current) {
            additionalData.customer_id = customerIdRef.current;
          }

          // Add threatMetrix if available
          if (threatMetrixIdRef.current) {
            additionalData.threat_metrix_id = threatMetrixIdRef.current;
          }

          // Add customer type from snapshot
          additionalData.customer_type = snap.customer.customerSettings.type;

          console.log(`[${methodCode}] Placing order with data:`, additionalData);

          // Place the order
          const response = await performPlaceOrder(payload, {
            additionalData: additionalData,
          });

          return true;
        } catch (err) {
          console.error(`[${methodCode}] Payment error:`, err);
          setErrorMessage(
              err?.message || `Unable to process ${paymentTag} payment.`
          );
          return false;
        } finally {
          submittingRef.current = false;
          setPageLoader(false);
        }
      },
      [
        methodCode,
        paymentTag,
        performPlaceOrder,
        setPageLoader,
        setErrorMessage,
        appCtx,
        cartCtx.cart,
      ]
  );

  // Mount Unzer elements
  useEffect(() => {
    if (!isSelected || !sdkReady || !mountRef.current) return () => {};

    // Check availability if callback provided
    if (onBeforeMount && !onBeforeMount()) {
      return () => {};
    }

    const mountNode = mountRef.current;
    mountNode.innerHTML = '';

    // Reset refs
    resourceIdRef.current = null;
    customerIdRef.current = null;
    threatMetrixIdRef.current = null;

    // <unzer-payment>
    const unzerPaymentEl = createUnzerPaymentEl({
      methodCode,
      publicKey,
      locale,
      paymentTag,
    });

    // <unzer-checkout>
    const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

    // Handle everything in onPaymentSubmit
    unzerCheckoutEl.onPaymentSubmit = async (response) => {
      console.log(`[${methodCode}] onPaymentSubmit called:`, response);

      // Store customer data if available
      if (response.customerResponse?.success) {
        customerIdRef.current = response.customerResponse.data.id;
        console.log(`[${methodCode}] Customer ID:`, customerIdRef.current);
      }

      // Store threatMetrix if available
      if (response.threatMetrixId) {
        threatMetrixIdRef.current = response.threatMetrixId;
        console.log(
            `[${methodCode}] ThreatMetrix ID:`,
            threatMetrixIdRef.current
        );
      }

      // Check if this is the payment submission response
      if (response.submitResponse?.success) {
        const resourceId = response.submitResponse.data.id;
        console.log(
            `[${methodCode}] Payment successful, resourceId:`,
            resourceId
        );

        // Store data
        resourceIdRef.current = resourceId;
        unzerCheckoutEl.dataset.resourceId = resourceId;

        try {
          // Call placeOrder immediately
          const success = await handlePlaceOrder(resourceId);

          if (success) {
            return { status: 'success' };
          } else {
            return { status: 'error', message: 'Failed to place order' };
          }
        } catch (error) {
          console.error(`[${methodCode}] Error in onPaymentSubmit:`, error);
          return { status: 'error', message: error.message };
        }
      }

      if (response.customerResponse?.success) {
        console.log(
            `[${methodCode}] Customer created, waiting for payment submission...`
        );
        return { status: 'success' };
      }

      console.error(`[${methodCode}] Payment submission failed:`, response);
      return {
        status: 'error',
        message:
            response.submitResponse?.message || 'Payment authentication failed',
      };
    };

    mountNode.appendChild(unzerPaymentEl);
    mountNode.appendChild(unzerCheckoutEl);

    paymentElRef.current = unzerPaymentEl;
    checkoutElRef.current = unzerCheckoutEl;

    refreshUnzerFromContexts(unzerPaymentEl, cartCtx?.cart, appCtx);

    // Wait for custom element to be defined and then set all required data
    const initializeWallet = async () => {
      try {
        console.log(
            `[${methodCode}] Waiting for custom element to be defined...`
        );

        // Wait for the custom element to be defined
        await customElements.whenDefined(customElementName);

        console.log(
            `[${methodCode}] Custom element defined, setting up data...`
        );

        // Small additional delay to ensure element is fully ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Configure payment-specific data
        if (onConfigurePaymentData) {
          await onConfigurePaymentData(unzerPaymentEl);
        }

        console.log(`[${methodCode}] Wallet initialization complete`);
      } catch (error) {
        console.error(`[${methodCode}] Failed to initialize wallet:`, error);
        setErrorMessage(
            `Failed to initialize ${paymentTag}. Please try again.`
        );
      }
    };

    initializeWallet();

    return () => {
      mountNode.innerHTML = '';
      paymentElRef.current = null;
      checkoutElRef.current = null;
    };
  }, [
    isSelected,
    sdkReady,
    publicKey,
    locale,
    methodCode,
    paymentTag,
    customElementName,
    cartCtx?.cart,
    appCtx,
    onConfigurePaymentData,
    onBeforeMount,
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

    // For wallet payments, the place order is handled inside onPaymentSubmit
    // This handler just prevents the default Hyvä place order behavior
    const handler = async (values) => {
      console.log(
          `[${methodCode}] Hyvä place order called - ${paymentTag} handles this internally`
      );
      return false;
    };

    registerPaymentAction(methodCode, handler);
    registeredRef.current = true;
    console.log(
        `[${methodCode}] Payment handler registered (${paymentTag} internal flow)`
    );
  }, [isSelected, methodCode, paymentTag, registerPaymentAction]);

  return {
    mountRef,
  };
}
