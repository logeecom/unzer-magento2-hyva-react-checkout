/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import { makeSubmitPromise } from '../dom/submit';

export default function UnzerPrepayment(props) {
    const methodCode = props.method?.code || 'unzer_prepayment';
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

    const onPlaceOrder = async ({ values, checkoutEl }) => {
        if (!checkoutEl) {
            setErrorMessage('Prepayment form not ready.');
            return false;
        }

        try {
            setPageLoader(true);

            const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
            checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

            const resourceId = await submitPromise;
            if (!resourceId) {
                setErrorMessage('Prepayment could not create payment type.');
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
            console.error('[UnzerPrepayment]', err);
            setErrorMessage(err?.message || 'Cannot process Prepayment.');
            return false;
        } finally {
            setPageLoader(false);
        }
    };

    return (
        <BaseUnzerRedirect
            {...props}
            paymentTag="unzer-prepayment"
            onPlaceOrder={onPlaceOrder}
        />
    );
}
