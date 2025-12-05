/* eslint-disable */
import React, { useCallback, useState, useEffect } from 'react';
import { shape, func } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import { paymentMethodShape } from '../../../../utils/payment';

import { getCheckoutConfig } from '../utility/config';
import { buildSnapshot } from '../utility/snapshot';

import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import BaseUnzerWallet from './BaseUnzerWallet';

export default function UnzerApplePay({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_applepayv2';
  const isSelected = methodCode === selected?.code;

  const cfg = getCheckoutConfig();
  const applePayCfg = cfg.payment[methodCode];
  const [appleAvailable, setAppleAvailable] = useState(true);

  const cartCtx = useCartContext();
  const appCtx = useAppContext();

  useEffect(() => {
    try {
      const available =
          typeof window !== 'undefined' &&
          window.ApplePaySession &&
          window.ApplePaySession.canMakePayments();
      setAppleAvailable(!!available);
    } catch (err) {
      setAppleAvailable(false);
    }
  }, []);

  // Configure Apple Pay data
  const setApplePayData = useCallback(
      async (unzerPaymentEl, maxRetries = 10, interval = 500) => {
        return new Promise((resolve, reject) => {
          let retries = 0;

          const trySetData = () => {
            const applePayEl = document.querySelector(
                `#unzer-payment-${methodCode}`
            );

            if (applePayEl && typeof applePayEl.setApplePayData === 'function') {
              const snap = buildSnapshot(cartCtx.cart, appCtx);

              // Get country code from billing address or config
              const countryCode =
                  snap.customer?.billingAddress?.country ||
                  applePayCfg?.country_code ||
                  'DE';

              // Get currency from snapshot or config
              const currencyCode = snap.currency || cfg.currency?.code;

              // Format amount
              const totalAmount = Number(snap.grandTotal || 0).toFixed(2);

              // Prepare Apple Pay payment request
              const applePayPaymentRequest = {
                countryCode,
                currencyCode,
                totalLabel: applePayCfg?.label || cfg.store?.name || 'Apple Pay',
                totalAmount,
                supportedNetworks: applePayCfg?.supportedNetworks || [],
                merchantCapabilities: applePayCfg?.merchantCapabilities || [
                  'supports3DS',
                ],
                requiredShippingContactFields: [],
                requiredBillingContactFields: [],
                total: {
                  label: applePayCfg?.label || cfg.store?.name || 'Apple Pay',
                  amount: totalAmount,
                },
              };

              console.log(
                  '[Unzer ApplePay] Setting Apple Pay data:',
                  applePayPaymentRequest
              );

              applePayEl.setApplePayData(applePayPaymentRequest);
              console.log('[Unzer ApplePay] Apple Pay data set successfully');
              resolve(true);
            } else if (retries < maxRetries) {
              retries++;
              console.warn(
                  `[Unzer ApplePay] Element not ready yet → retrying... (${retries}/${maxRetries})`
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
      [cartCtx.cart, appCtx, cfg, applePayCfg, methodCode]
  );

  // SET CUSTOMER DATA
  const setCustomerAndBasketData = useCallback(
      async (unzerPaymentEl, maxRetries = 10, interval = 500) => {
        return new Promise((resolve, reject) => {
          let retries = 0;

          const trySetData = () => {
            const el = document.querySelector(`#unzer-payment-${methodCode}`);

            if (
                el &&
                typeof el.setBasketData === 'function' &&
                typeof el.setCustomerData === 'function'
            ) {
              const snap = buildSnapshot(cartCtx.cart, appCtx);

              // Set basket data
              el.setBasketData({
                amount: snap.grandTotal,
                currencyType: snap.currency,
              });

              // Set customer data
              console.log(
                  '[Unzer ApplePay] Setting customer data:',
                  snap.customer
              );
              el.setCustomerData(snap.customer);

              resolve(true);
            } else if (retries < maxRetries) {
              retries++;
              console.warn(
                  `[Unzer ApplePay] Customer/Basket data functions not ready → retrying... (${retries}/${maxRetries})`
              );
              setTimeout(trySetData, interval);
            } else {
              console.error(
                  '[Unzer ApplePay] Failed to set customer/basket data after multiple retries'
              );
              reject(new Error('Customer/Basket data functions not ready'));
            }
          };

          trySetData();
        });
      },
      [cartCtx.cart, appCtx, methodCode]
  );

  // Configure payment data callback
  const onConfigurePaymentData = useCallback(
      async (unzerPaymentEl) => {
        // Set customer and basket data FIRST
        await setCustomerAndBasketData(unzerPaymentEl);

        // Then set Apple Pay data
        await setApplePayData(unzerPaymentEl);
      },
      [setCustomerAndBasketData, setApplePayData]
  );

  // Use base wallet component
  const { mountRef } = BaseUnzerWallet({
    methodCode,
    isSelected,
    paymentTag: 'unzer-apple-pay',
    customElementName: 'unzer-apple-pay',
    onConfigurePaymentData,
  });

  // RENDER
  return (
      <div>
        <RadioInput
            value={method.code}
            label={method.title}
            name="paymentMethod"
            checked={isSelected}
            onChange={actions.change}
        />

        {isSelected && !appleAvailable && (
            <p style={{ marginTop: 8, color: 'red', padding: '0 1rem' }}>
              Apple Pay is not available on this device.
            </p>
        )}
      </div>
  );
}

UnzerApplePay.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape.isRequired,
  actions: shape({ change: func }).isRequired,
};
