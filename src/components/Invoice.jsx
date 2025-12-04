/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import { buildSnapshot } from '../utility/snapshot';

export default function UnzerInvoiceB2B(props) {
  const methodCode = props.method?.code || 'unzer_paylater_invoice_b2b';
  const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
  const { setPageLoader, setErrorMessage, isLoggedIn, customer } =
      useAppContext();

  const onPlaceOrder = async ({ values, checkoutEl, methodCode }) => {
    if (!checkoutEl) {
      setErrorMessage('Invoice B2B form not ready.');
      return false;
    }

    try {
      setPageLoader(true);

      // Custom Promise wrapper for Unzer callback
      const submitPromise = new Promise((resolve, reject) => {
        checkoutEl.onPaymentSubmit = async (resp) => {
          try {
            const ok =
                resp?.submitResponse?.success ||
                resp?.submitResponse?.status === 'SUCCESS';

            if (!ok) {
              const msg =
                  resp?.submitResponse?.message ||
                  resp?.submitResponse?.details?.customerMessage ||
                  'Payment failed';
              return reject(new Error(msg));
            }

            resolve({
              resourceId: resp?.submitResponse?.data?.id || null,
              customerId: resp?.customerResponse?.data?.id || null,
              threatMetrixId: resp?.threatMetrixId || null,
            });
          } catch (e) {
            reject(e);
          } finally {
            checkoutEl.onPaymentSubmit = null;
          }
        };
      });

      // Trigger Unzer UI submit
      checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

      // Wait for Unzer response
      const { resourceId, customerId, threatMetrixId } = await submitPromise;

      // Build snapshot for birthDate / company info
      const snapshot = buildSnapshot(props?.cartCtx?.cart, props?.appCtx);
      const birthDate = snapshot?.customer?.birthDate || null;

      // Build payload
      const payload = isLoggedIn
          ? {}
          : { login: { email: values?.login?.email || values?.email } };

      const additionalData = {
        resource_id: resourceId,
        customer_id: customerId,
        threat_metrix_id: threatMetrixId,
        customer_type: 'b2b',
        birthDate,
      };

      await performPlaceOrder(payload, { additionalData });

      window.location.href = `${window.BASE_URL || '/'}unzer/payment/redirect`;

      return true;
    } catch (err) {
      console.error('[UnzerInvoiceB2B]', err);
      setErrorMessage(err?.message || 'Unable to process Invoice B2B payment.');
      return false;
    } finally {
      setPageLoader(false);
    }
  };

  return (
      <BaseUnzerRedirect
          {...props}
          paymentTag="unzer-paylater-invoice"
          onPlaceOrder={onPlaceOrder}
      />
  );
}
