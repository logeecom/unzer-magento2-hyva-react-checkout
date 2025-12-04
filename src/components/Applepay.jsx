/* eslint-disable */
import React, { useCallback, useState, useEffect } from 'react';
import { shape, func } from 'prop-types';
import { paymentMethodShape } from '../../../../utils/payment';

import BaseUnzerRedirect from './BaseUnzerRedirect';
import { getCheckoutConfig } from '../utility/config';
import useHidePlaceOrderForWalletMethods from '../hooks/useHidePlaceOrderButton';

export default function UnzerApplePay({ method, selected, actions }) {
  const methodCode = method?.code || 'unzer_applepayv2';
  const isSelected = methodCode === selected?.code;
  const cfg = getCheckoutConfig();
  const applePayCfg = cfg.payment[methodCode];
  const [appleAvailable, setAppleAvailable] = useState(true);

  useHidePlaceOrderForWalletMethods(isSelected, methodCode);

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

  const beforeSnapshot = useCallback(
      (paymentEl, snap) => {
        if (!paymentEl || !applePayCfg || !appleAvailable) return;

        const setApplePayData = async () => {
          const maxRetries = 10;
          const interval = 500;

          return new Promise((resolve, reject) => {
            let retries = 0;

            const trySetData = () => {
              if (paymentEl && typeof paymentEl.setApplePayData === 'function') {
                const supportedNetworks = (
                    applePayCfg.supportedNetworks || []
                ).map((x) => String(x).toLowerCase());

                const merchantCapabilities = applePayCfg.merchantCapabilities || [
                  'supports3DS',
                ];

                const label = applePayCfg.label || cfg.store?.name || 'Apple Pay';

                paymentEl.setApplePayData({
                  countryCode: snap.billing?.country || 'DE',
                  currencyCode: snap.currency,
                  totalLabel: label,
                  totalAmount: String(snap.grandTotal.toFixed(2)),
                  supportedNetworks,
                  merchantCapabilities,
                  requiredShippingContactFields: [],
                  requiredBillingContactFields: [],
                  total: {
                    label,
                    amount: String(snap.grandTotal.toFixed(2)),
                  },
                });
                resolve(true);
              } else if (retries < maxRetries) {
                retries += 1;
                setTimeout(trySetData, interval);
              } else {
                reject(new Error('Apple Pay element not ready'));
              }
            };

            trySetData();
          });
        };

        setApplePayData().catch((err) => {
          console.error('[Unzer ApplePay] Failed to set Apple Pay data:', err);
        });
      },
      [applePayCfg, appleAvailable, cfg.store?.name]
  );

  const submitHandler = useCallback(async ({ checkoutEl, methodCode }) => {
    return null;
  }, []);

  const buildAdditionalData = useCallback(
      (submitResult, { values, appCtx, cartCtx }) => {
        const additionalData = {
          resource_id: submitResult.resourceId,
        };

        const billing =
            cartCtx.cart?.billing_address || cartCtx.cart?.billingAddress;
        additionalData.customer_type =
            billing?.company && billing.company.trim() !== '' ? 'B2B' : 'B2C';

        return additionalData;
      },
      []
  );

  return (
      <div>
        <BaseUnzerRedirect
            method={method}
            selected={selected}
            actions={actions}
            paymentTag="unzer-apple-pay"
            beforeSnapshot={beforeSnapshot}
            submitHandler={submitHandler}
            buildAdditionalData={buildAdditionalData}
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
