/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import { makeSubmitPromise } from '../dom/submit';
import useAppContext from '../../../../hook/useAppContext';

export default function UnzerEPS(props) {
    const methodCode = props.method?.code || 'unzer_eps';
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

    const onPlaceOrder = async ({ values, checkoutEl }) => {
        if (!checkoutEl) {
            setErrorMessage('EPS UI not ready.');
            return false;
        }

        try {
            setPageLoader(true);

            const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
            checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

            const resourceId = await submitPromise;
            if (!resourceId) {
                setErrorMessage('EPS could not create payment type.');
                return false;
            }

            const payload = {};
            if (!isLoggedIn) {
                payload.login = { email: values?.login?.email || values?.email };
            }

            const resp = await performPlaceOrder(payload, {
                additionalData: { resource_id: resourceId },
            });

            window.location.href =
                resp?.redirect_url ?? `${window.BASE_URL || '/'}unzer/payment/redirect`;

            return true;
        } catch (err) {
            console.error('[UnzerEPS]', err);
            setErrorMessage(err?.message || 'Unable to process EPS payment.');
            return false;
        } finally {
            setPageLoader(false);
        }
    };

    return (
        <BaseUnzerRedirect
            {...props}
            paymentTag="unzer-eps"
            onPlaceOrder={onPlaceOrder}
        />
    );
}
