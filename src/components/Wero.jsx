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

/**
 * Unzer Wero – Redirect Component
 */
export default function UnzerWero({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_wero';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);

    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-wero'],
        waitForCheckout: true,
    });

    const publicKey = getUnzerPublicKey(methodCode);
    const locale = getLocale();

    const mountRef = useRef(null);
    const paymentElRef = useRef(null);
    const checkoutElRef = useRef(null);
    const submittingRef = useRef(false);
    const registeredRef = useRef(false);

    /**
     * Mount Unzer Elements
     */
    const mountUnzerElements = useCallback(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;
        if (paymentElRef.current && checkoutElRef.current) return;

        const mountNode = mountRef.current;
        mountNode.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-wero',
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        mountNode.appendChild(unzerPaymentEl);
        mountNode.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        // Update pricing & customer info
        try {
            refreshUnzerFromContexts(unzerPaymentEl, cartCtx.cart, appCtx);
        } catch (e) {
            console.warn('[UnzerWero] snapshot failed:', e);
        }
    }, [isSelected, sdkReady, publicKey, locale]);

    useEffect(() => {
        mountUnzerElements();

        return () => {
            const mountNode = mountRef.current;
            if (mountNode) mountNode.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [mountUnzerElements]);

    /**
     * Register place-order handler (only once)
     */
    useEffect(() => {
        if (!isSelected) {
            registerPaymentAction(methodCode, undefined);
            submittingRef.current = false;
            registeredRef.current = false;
            return;
        }

        if (registeredRef.current) return;

        const handler = async (values) => {
            if (submittingRef.current) return false;

            try {
                const checkoutEl = checkoutElRef.current;
                if (!checkoutEl) {
                    setErrorMessage('Wero form not ready.');
                    return false;
                }

                setPageLoader(true);

                // Submit Wero checkout UI
                const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });

                submittingRef.current = true;
                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

                const resourceId = await submitPromise;

                if (!resourceId) {
                    setErrorMessage('Wero could not generate payment type.');
                    return false;
                }

                // Guest mode support
                const payload = {};
                if (!appCtx.isLoggedIn) {
                    payload.login = {
                        email: values?.login?.email || values?.email,
                    };
                }

                const result = await performPlaceOrder(payload, {
                    additionalData: {
                        resource_id: resourceId,
                    },
                });

                window.location.href =
                    result?.redirect_url ??
                    `${window.BASE_URL || '/'}unzer/payment/redirect`;

                return true;
            } catch (err) {
                console.error('[UnzerWero Error]', err);
                setErrorMessage(err?.message || 'Unable to process Wero payment.');
                return false;
            } finally {
                submittingRef.current = false;
                setPageLoader(false);
            }
        };

        registerPaymentAction(methodCode, handler);
        registeredRef.current = true;
    }, [isSelected]);

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
                        gap: '1rem',
                        minHeight: 160,
                    }}
                />
            )}
        </div>
    );
}

UnzerWero.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
