/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';
import { buildSnapshot } from '../utility/snapshot';

export default function UnzerInvoiceB2B(props) {
  const submitHandler = ({ checkoutEl, methodCode }) => {
    return new Promise((resolve, reject) => {
      checkoutEl.onPaymentSubmit = (resp) => {
        try {
          const ok =
              resp?.submitResponse?.success ||
              resp?.submitResponse?.status === 'SUCCESS';

          if (!ok) {
            return reject(
                new Error(
                    resp?.submitResponse?.message ||
                    resp?.submitResponse?.details?.customerMessage ||
                    'Invoice B2B failed'
                )
            );
          }

          resolve({
            resourceId: resp?.submitResponse?.data?.id || null,
            customerId: resp?.customerResponse?.data?.id || null,
            threatMetrixId: resp?.threatMetrixId || null,
          });
        } finally {
          checkoutEl.onPaymentSubmit = null;
        }
      };

      checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();
    });
  };

  const buildAdditionalData = (submitResult, { appCtx, cartCtx }) => {
    const snapshot = buildSnapshot(cartCtx.cart, appCtx);
    return {
      resource_id: submitResult.resourceId,
      customer_id: submitResult.customerId,
      threat_metrix_id: submitResult.threatMetrixId,
      customer_type: 'b2b',
      birthDate: snapshot?.customer?.birthDate || null,
    };
  };

  return (
      <BaseUnzerRedirect
          {...props}
          paymentTag="unzer-paylater-invoice"
          submitHandler={submitHandler}
          buildAdditionalData={buildAdditionalData}
      />
  );
}
