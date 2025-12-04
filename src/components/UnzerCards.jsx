/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';

import useUnzerPerformPlaceOrder from '../hooks/useUnzerPlaceOrder';
import useAppContext from '../../../../hook/useAppContext';
import { makeSubmitPromise } from '../dom/submit';

export default function UnzerCards(props) {
    const methodCode = props.method?.code || 'unzer_cards';
    const performPlaceOrder = useUnzerPerformPlaceOrder(methodCode);
    const { setPageLoader, setErrorMessage, isLoggedIn } = useAppContext();

    const onPlaceOrder = async ({ values, checkoutEl, methodCode }) => {
        try {
            if (!checkoutEl) {
                setErrorMessage('Card form not ready.');
                return false;
            }

            setPageLoader(true);

            // save card?
            const shouldSave =
                document.getElementById(`cards-save-${methodCode}`)?.checked === true;

            // set "store" mode directly on element
            const paymentEl = checkoutEl.previousSibling;
            if (paymentEl) {
                paymentEl.setAttribute(
                    'card-detail-mode',
                    shouldSave ? 'store' : 'none'
                );
            }

            const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
            checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

            const resourceId = await submitPromise;
            if (!resourceId) {
                setErrorMessage('Failed to get card resource ID.');
                return false;
            }

            const payload = {};
            if (!isLoggedIn) {
                payload.login = { email: values?.login?.email || values?.email };
            }

            await performPlaceOrder(payload, {
                additionalData: {
                    resource_id: resourceId,
                    is_active_payment_token_enabler: shouldSave ? '1' : '0',
                },
            });

            return true;
        } catch (err) {
            console.error('[UnzerCards]', err);
            setErrorMessage(err?.message || 'Unable to process card payment.');
            return false;
        } finally {
            setPageLoader(false);
        }
    };

    return (
        <div>
            <BaseUnzerRedirect
                {...props}
                paymentTag="unzer-card"
                onPlaceOrder={onPlaceOrder}
            />

            {/* Save card checkbox */}
            {isLoggedIn && props.selected?.code === props.method?.code && (
                <label
                    htmlFor={`cards-save-${methodCode}`}
                    style={{ display: 'flex', gap: 8, marginTop: 8 }}
                >
                    <input type="checkbox" id={`cards-save-${methodCode}`} />
                    Save this card
                </label>
            )}
        </div>
    );
}
