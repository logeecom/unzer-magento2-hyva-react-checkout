/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import { makeSubmitPromise } from '../dom/submit';
import useAppContext from '../../../../hook/useAppContext';

export default function UnzerAlipay(props) {
    const methodCode = props.method?.code || 'unzer_alipay';
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

    const onPlaceOrder = async ({ values, checkoutEl }) => {
        if (!checkoutEl) {
            setErrorMessage('Alipay form not ready.');
            return false;
        }

        try {
            setPageLoader(true);

            const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
            checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

            const resourceId = await submitPromise;

            const payload = {};
            if (!isLoggedIn) {
                payload.login = {
                    email: values?.login?.email || values?.email,
                };
            }

            const resp = await performPlaceOrder(payload, {
                additionalData: {
                    resource_id: resourceId,
                },
            });

            window.location.href =
                resp?.redirect_url ?? `${window.BASE_URL || '/'}unzer/payment/redirect`;

            return true;
        } catch (err) {
            console.error('[UnzerAlipay]', err);
            setErrorMessage(err?.message || 'Unable to process Alipay payment.');
            return false;
        } finally {
            setPageLoader(false);
        }
    };

    return (
        <BaseUnzerRedirect
            {...props}
            paymentTag="unzer-alipay"
            onPlaceOrder={onPlaceOrder}
        />
    );
}
