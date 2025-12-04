/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import { makeSubmitPromise } from '../dom/submit';
import useAppContext from '../../../../hook/useAppContext';

export default function UnzerPrzelewy24(props) {
  const methodCode = props.method?.code || 'unzer_przelewy24';
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

  const onPlaceOrder = async ({ values, checkoutEl }) => {
    if (!checkoutEl) {
      setErrorMessage('P24 form not ready.');
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

      const resp = await performPlaceOrder(payload, {
        additionalData: { resource_id: resourceId },
      });

      window.location.replace(
          `${window.BASE_URL || '/'}unzer/payment/redirect`
      );

      return true;
    } catch (err) {
      console.error('[UnzerPrzelewy24]', err);
      setErrorMessage(err?.message || 'Unable to process Przelewy24 payment.');
      return false;
    } finally {
      setPageLoader(false);
    }
  };

  return (
      <BaseUnzerRedirect
          {...props}
          paymentTag="unzer-przelewy24"
          onPlaceOrder={onPlaceOrder}
      />
  );
}
