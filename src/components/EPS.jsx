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

export default function UnzerEPS({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_eps';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();
    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-eps'],
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
     * Mount EPS UI Components
     */
    const mountUnzerElements = useCallback(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;
        if (paymentElRef.current && checkoutElRef.current) return;

        const node = mountRef.current;
        node.innerHTML = '';

        // unzer-payment + <unzer-eps>
        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-eps',
        });

        // unzer-checkout + submit button
        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        node.appendChild(unzerPaymentEl);
        node.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        refreshUnzerFromContexts(unzerPaymentEl, cartCtx.cart, appCtx);

        unzerCheckoutEl.addEventListener('error', (e) => {
            console.error('[UnzerEPS UI Error]', e?.detail);
        });
    }, [isSelected, sdkReady]);

    useEffect(() => {
        mountUnzerElements();
        return () => {
            if (mountRef.current) mountRef.current.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [mountUnzerElements]);

    /**
     * Register place-order for EPS
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
                    setErrorMessage('EPS UI not ready.');
                    return false;
                }

                setPageLoader(true);

                const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
                submittingRef.current = true;

                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

                const resourceId = await submitPromise;

                if (!resourceId) {
                    setErrorMessage('EPS could not create payment type.');
                    return false;
                }

                const payload = {};
                if (!appCtx.isLoggedIn) {
                    payload.login = {
                        email: values?.login?.email || values?.email,
                    };
                }

                const resp = await performPlaceOrder(payload, {
                    additionalData: { resource_id: resourceId },
                });

                // eslint-disable-next-line no-console
                console.log(resp);

                window.location.replace(
                    `${window.BASE_URL || '/'}unzer/payment/redirect`
                );
                return true;
            } catch (err) {
                console.error('[UnzerEPS Error]', err);
                setErrorMessage(err?.message || 'Unable to process EPS payment.');
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
                        minHeight: 200,
                    }}
                />
            )}
        </div>
    );
}

UnzerEPS.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
