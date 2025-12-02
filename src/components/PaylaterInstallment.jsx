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

export default function UnzerPaylaterInstallment({
                                                     method,
                                                     selected,
                                                     actions,
                                                 }) {
    const methodCode = method?.code || 'unzer_paylater_installment';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-paylater-installment'],
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

    // Mount component
    useEffect(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;

        mountRef.current.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-paylater-installment',
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        mountRef.current.appendChild(unzerPaymentEl);
        mountRef.current.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        refreshUnzerFromContexts(paymentElRef.current, cartCtx.cart, appCtx);

        return () => {
            mountRef.current.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [isSelected, sdkReady, publicKey, locale, methodCode]);

    // Register handler
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
                    setErrorMessage('Payment form not ready.');
                    return false;
                }

                const submitBtn =
                    checkoutEl.shadowRoot?.querySelector('button') ||
                    checkoutEl.querySelector('button');

                if (submitBtn?.disabled) {
                    setErrorMessage('Please complete the form.');
                    return false;
                }

                setPageLoader(true);

                const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
                refreshUnzerFromContexts(paymentElRef.current, cartCtx.cart, appCtx);

                submittingRef.current = true;
                inflightRef.current = submitPromise;

                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();
                const resourceId = await submitPromise;

                const payload = {};
                if (!appCtx.isLoggedIn) {
                    payload.login = { email: values?.login?.email || values?.email };
                }

                await performPlaceOrder(payload, {
                    additionalData: { resource_id: resourceId || null },
                });

                window.location.replace(
                    `${window.BASE_URL || '/'}unzer/payment/redirect`
                );
                return true;
            } catch (err) {
                console.error('[UnzerPaylaterInstallment] Error:', err);
                setErrorMessage(err?.message || 'Installment payment failed.');
                return false;
            } finally {
                submittingRef.current = false;
                inflightRef.current = null;
                setPageLoader(false);
            }
        };

        registerPaymentAction(methodCode, handler);
        registeredRef.current = true;

        return () => {
            registerPaymentAction(methodCode, undefined);
            registeredRef.current = false;
            submittingRef.current = false;
            inflightRef.current = null;
        };
    }, [
        isSelected,
        methodCode,
        registerPaymentAction,
        performPlaceOrder,
        setPageLoader,
        setErrorMessage,
    ]);

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
        </div>
    );
}

UnzerPaylaterInstallment.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
