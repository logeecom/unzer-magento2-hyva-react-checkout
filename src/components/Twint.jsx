/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import { makeSubmitPromise } from '../dom/submit';
import useAppContext from '../../../../hook/useAppContext';

export default function UnzerTwint(props) {
  const methodCode = props.method?.code || 'unzer_twint';
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

  const onPlaceOrder = async ({ values, checkoutEl }) => {
    if (!checkoutEl) {
      setErrorMessage('TWINT form not ready.');
      return false;
    }

    try {
      setPageLoader(true);

      const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
      checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

      const resourceId = await submitPromise;

      const payload = {};
      if (!isLoggedIn) {
        payload.login = { email: values?.login?.email || values?.email };
      }

      const result = await performPlaceOrder(payload, {
        additionalData: { resource_id: resourceId },
      });

      window.location.href =
          result?.redirect_url ||
          `${window.BASE_URL || '/'}unzer/payment/redirect`;

      return true;
    } catch (err) {
      console.error('[UnzerTwint]', err);
      setErrorMessage(err?.message || 'Unable to process TWINT payment.');
      return false;
    } finally {
      setPageLoader(false);
    }
  };

  return (
      <BaseUnzerRedirect
          {...props}
          paymentTag="unzer-twint"
          onPlaceOrder={onPlaceOrder}
      />
  );
}
