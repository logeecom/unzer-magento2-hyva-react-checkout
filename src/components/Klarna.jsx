/* eslint-disable */

import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';
import useAppContext from '../../../../hook/useAppContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import { makeSubmitPromise } from '../dom/submit';

export default function UnzerKlarna({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_klarna';
    const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);

    const onPlaceOrder = async ({ values, checkoutEl }) => {
        if (!checkoutEl) {
            setErrorMessage('Klarna form not ready.');
            return false;
        }

        try {
            setPageLoader(true);

            const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
            checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

            const resourceId = await submitPromise;
            if (!resourceId) {
                setErrorMessage('Klarna: no resource id');
                return false;
            }

            const payload = {};
            if (!isLoggedIn) {
                payload.login = { email: values?.login?.email || values?.email };
            }

            await performPlaceOrder(payload, {
                additionalData: { resource_id: resourceId },
            });

            window.location.replace(
                `${window.BASE_URL || '/'}unzer/payment/redirect`
            );
            return true;
        } catch (err) {
            console.error('[UnzerKlarna]', err);
            setErrorMessage(err?.message || 'Unable to process Klarna payment.');
            return false;
        } finally {
            setPageLoader(false);
        }
    };

    return (
        <BaseUnzerRedirect
            method={method}
            selected={selected}
            actions={actions}
            paymentTag="unzer-klarna"
            onPlaceOrder={onPlaceOrder}
        />
    );
}
