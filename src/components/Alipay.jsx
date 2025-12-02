/* eslint-disable */
import React, { useEffect, useRef } from 'react';
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

export default function UnzerAlipay({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_alipay';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-alipay'],
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

    /** Mount Unzer Elements */
    useEffect(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;

        const mountNode = mountRef.current;
        mountNode.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-alipay',
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        mountNode.appendChild(unzerPaymentEl);
        mountNode.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        refreshUnzerFromContexts(paymentElRef.current, cartCtx.cart, appCtx);

        return () => {
            mountNode.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [isSelected, sdkReady, publicKey, locale, methodCode]);

    /** Register Place Order Handler */
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
                    setErrorMessage('Alipay form not ready.');
                    return false;
                }

                setPageLoader(true);

                const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });

                submittingRef.current = true;
                inflightRef.current = submitPromise;

                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

                const resourceId = await submitPromise;

                let placeOrderPayload = {};
                if (!appCtx.isLoggedIn) {
                    placeOrderPayload = {
                        login: {
                            email: values?.login?.email || values?.email,
                        },
                    };
                }

                await performPlaceOrder(placeOrderPayload, {
                    additionalData: {
                        resource_id: resourceId ?? null,
                    },
                });

                window.location.href = `${
                    window.BASE_URL || '/'
                }unzer/payment/redirect`;

                return true;
            } catch (err) {
                console.error('[UnzerAlipay] Error:', err);
                setErrorMessage(err?.message || 'Unable to process Alipay payment.');
                return false;
            } finally {
                submittingRef.current = false;
                inflightRef.current = null;
                setPageLoader(false);
            }
        };

        registerPaymentAction(methodCode, handler);
        registeredRef.current = true;
    }, [isSelected, methodCode]);

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
                        minHeight: 160,
                        display: 'grid',
                        gap: '1rem',
                    }}
                />
            )}
        </div>
    );
}

UnzerAlipay.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
