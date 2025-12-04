/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import { makeSubmitPromise } from '../dom/submit';

export default function UnzerPaypal(props) {
    const methodCode = props.method?.code || 'unzer_paypal';
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

    const onPlaceOrder = async ({ values, checkoutEl }) => {
        try {
            if (!checkoutEl) {
                setErrorMessage('PayPal form not ready.');
                return false;
            }

            setPageLoader(true);

            const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
            checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

            const resourceId = await submitPromise;
            if (!resourceId) {
                setErrorMessage('Missing PayPal resource ID.');
                return false;
            }

            // token save checkbox
            const shouldSave = document.getElementById(`paypal-save-${methodCode}`)
                ?.checked
                ? '1'
                : '0';

            const payload = {};
            if (!isLoggedIn) {
                payload.login = { email: values?.login?.email || values?.email };
            }

            await performPlaceOrder(payload, {
                additionalData: {
                    resource_id: resourceId,
                    is_active_payment_token_enabler: shouldSave,
                },
            });

            window.location.replace(
                `${window.BASE_URL || '/'}unzer/payment/redirect`
            );
            return true;
        } catch (e) {
            console.error('[UnzerPaypal]', e);
            setErrorMessage(e?.message || 'Cannot process PayPal.');
            return false;
        } finally {
            setPageLoader(false);
        }
    };

    return (
        <div>
            <BaseUnzerRedirect
                {...props}
                paymentTag="unzer-paypal"
                onPlaceOrder={onPlaceOrder}
            />

            {/* Save token checkbox (only if logged in) */}
            {isLoggedIn && props.selected?.code === props.method?.code && (
                <label
                    htmlFor={`paypal-save-${methodCode}`}
                    style={{ display: 'flex', gap: 8, marginTop: 8 }}
                >
                    <input type="checkbox" id={`paypal-save-${methodCode}`} />
                    Save for later use
                </label>
            )}
        </div>
    );
}
