/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import { makeSubmitPromise } from '../dom/submit';

export default function UnzerSepaDirectDebit(props) {
  const methodCode = props.method?.code || 'unzer_direct_debit';
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

  const onPlaceOrder = async ({ values, checkoutEl }) => {
    try {
      if (!checkoutEl) {
        setErrorMessage('SEPA form not ready.');
        return false;
      }

      setPageLoader(true);

      const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
      checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

      const resourceId = await submitPromise;
      if (!resourceId) {
        setErrorMessage('SEPA: resourceId missing.');
        return false;
      }

      const shouldSave = document.getElementById(`sepa-save-${methodCode}`)
          ?.checked
          ? '1'
          : '0';

      const payload = {};
      if (!isLoggedIn) {
        payload.login = { email: values?.login?.email || values?.email };
      }

      const result = await performPlaceOrder(payload, {
        additionalData: {
          resource_id: resourceId,
          is_active_payment_token_enabler: shouldSave,
        },
      });

      window.location.href =
          result?.redirect_url ||
          `${window.BASE_URL || '/'}unzer/payment/redirect`;
      return true;
    } catch (err) {
      console.error('[UnzerSepaDirectDebit]', err);
      setErrorMessage(err?.message || 'Unable to process SEPA direct debit.');
      return false;
    } finally {
      setPageLoader(false);
    }
  };

  return (
      <div>
        <BaseUnzerRedirect
            {...props}
            paymentTag="unzer-sepa-direct-debit"
            onPlaceOrder={onPlaceOrder}
        />

        {isLoggedIn && props.selected?.code === props.method?.code && (
            <label
                htmlFor={`sepa-save-${methodCode}`}
                style={{ display: 'flex', gap: 8, marginTop: 8 }}
            >
              <input type="checkbox" id={`sepa-save-${methodCode}`} />
              Save for later use
            </label>
        )}
      </div>
  );
}
