/* eslint-disable */
import React, { useEffect, useRef, useCallback } from 'react';
import { shape, func } from 'prop-types';
import { paymentMethodShape } from '../../../../utils/payment';

import RadioInput from '../../../../components/common/Form/RadioInput';

import useUnzerSdk from '../hooks/useUnzerSdk';
import { getUnzerPublicKey, getLocale } from '../utility/config';

import {
    createUnzerPaymentEl,
    createUnzerCheckoutEl,
} from '../dom/createElements';

import { makeSubmitPromise } from '../dom/submit';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import { refreshUnzerFromContexts } from '../utility/snapshot';

export default function UnzerPaypal({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_paypal';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-paypal'],
        waitForCheckout: true,
    });

    const publicKey = getUnzerPublicKey(methodCode);
    const locale = getLocale();

    const mountRef = useRef(null);
    const paymentElRef = useRef(null);
    const checkoutElRef = useRef(null);
    const submittingRef = useRef(false);
    const inflightRef = useRef(null);
    const registeredRef = useRef(false);

    /**
     * Safe mount function
     */
    const mountUnzerElements = useCallback(() => {
        if (!isSelected || !sdkReady || !mountRef.current) {
            return;
        }

        const mountNode = mountRef.current;

        // Prevent double-mount
        if (paymentElRef.current && checkoutElRef.current) {
            return;
        }

        mountNode.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-paypal',
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        mountNode.appendChild(unzerPaymentEl);
        mountNode.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        try {
            refreshUnzerFromContexts(unzerPaymentEl, cartCtx.cart, appCtx);
        } catch (e) {
            console.warn('[UnzerPaypal] refresh error:', e);
        }
    }, [isSelected, sdkReady, publicKey, locale]);

    /**
     * Mount lifecycle
     */
    useEffect(() => {
        mountUnzerElements();

        return () => {
            const mountNode = mountRef.current;
            if (mountNode) {
                mountNode.innerHTML = '';
            }
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [mountUnzerElements]);

    /**
     * Register place-order handler
     */
    useEffect(() => {
        if (!isSelected) {
            registerPaymentAction(methodCode, undefined);
            registeredRef.current = false;
            submittingRef.current = false;
            inflightRef.current = null;
            return;
        }

        if (registeredRef.current) return;

        const handler = async (values) => {
            if (submittingRef.current) return false;

            try {
                const checkoutEl = checkoutElRef.current;
                if (!checkoutEl) {
                    setErrorMessage('PayPal form not ready.');
                    return false;
                }

                const btn =
                    checkoutEl.shadowRoot?.querySelector('button') ||
                    checkoutEl.querySelector('button');

                if (btn?.disabled) {
                    setErrorMessage('Please complete PayPal authorization first.');
                    return false;
                }

                setPageLoader(true);

                const saveCheckbox = document.getElementById(
                    `paypal-save-token-${methodCode}`
                );
                const shouldSave = saveCheckbox?.checked ? '1' : '0';

                const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });

                submittingRef.current = true;
                inflightRef.current = submitPromise;

                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

                const resourceId = await submitPromise;

                let placeOrderPayload = {};
                if (!appCtx.isLoggedIn) {
                    placeOrderPayload = {
                        login: { email: values?.login?.email || values?.email },
                    };
                }

                const result = await performPlaceOrder(placeOrderPayload, {
                    additionalData: {
                        resource_id: resourceId ?? null,
                        is_active_payment_token_enabler: shouldSave,
                    },
                });

                // eslint-disable-next-line no-console
                console.log(result);

                window.location.replace(
                    `${window.BASE_URL || '/'}unzer/payment/redirect`
                );

                return true;
            } catch (err) {
                console.error('[UnzerPaypal] Error:', err);
                setErrorMessage(err?.message || 'Unable to process PayPal payment.');
                return false;
            } finally {
                submittingRef.current = false;
                inflightRef.current = null;
                setPageLoader(false);
            }
        };

        registerPaymentAction(methodCode, handler);
        registeredRef.current = true;
    }, [isSelected]);

    const isLoggedIn = Object.keys(appCtx.customer || {}).length > 0;

    return (
        <div>
            <RadioInput
                value={method.code}
                label={method.title}
                name="paymentMethod"
                checked={isSelected}
                onChange={actions.change}
            />

            {isSelected && (
                <div
                    id={`unzer-mount-${methodCode}`}
                    ref={mountRef}
                    style={{
                        marginTop: 12,
                        display: 'grid',
                        gap: '0.75rem',
                        minHeight: 160,
                    }}
                />
            )}

            {isSelected && isLoggedIn && (
                <label
                    htmlFor={`paypal-save-token-${methodCode}`}
                    style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        marginTop: '0.5rem',
                    }}
                >
                    <input type="checkbox" id={`paypal-save-token-${methodCode}`} />
                    <span>Save for later use.</span>
                </label>
            )}
        </div>
    );
}

UnzerPaypal.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
