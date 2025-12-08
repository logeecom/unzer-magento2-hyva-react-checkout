/* eslint-disable */
import React, { useEffect, useRef, useCallback } from 'react';
import RadioInput from '../../../../components/common/Form/RadioInput';

import useUnzerSdk from '../hooks/useUnzerSdk';
import useUnzerPerformPlaceOrder from '../hooks/useUnzerPlaceOrder';

import {
    getUnzerPublicKey,
    getLocale,
    getEnableClickToPay,
} from '../utility/config';
import {
    createUnzerPaymentEl,
    createUnzerCheckoutEl,
} from '../dom/createElements';
import { makeSubmitPromise } from '../dom/submit';

import useCartContext from '../../../../hook/useCartContext';
import useAppContext from '../../../../hook/useAppContext';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import { refreshUnzerFromContexts } from '../utility/snapshot';

export default function BaseUnzerRedirect({
                                              method,
                                              selected,
                                              actions,
                                              paymentTag,
                                              beforeSnapshot,
                                              submitHandler,
                                              buildAdditionalData,
                                          }) {
    const methodCode = method?.code || '';
    const isSelected = methodCode === selected?.code;

    const enableCTP = getEnableClickToPay(methodCode);

    const performPlaceOrder = useUnzerPerformPlaceOrder(methodCode);

    const cartCtx = useCartContext();
    const appCtx = useAppContext();
    const { isLoggedIn, setPageLoader, setErrorMessage } = appCtx;
    const { registerPaymentAction } = useCheckoutFormContext();

    const sdkReady = useUnzerSdk({
        components: [paymentTag],
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
     * Mount Unzer elements
     */
    const mountUnzerElements = useCallback(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;

        const node = mountRef.current;
        node.innerHTML = '';

        const paymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            enableCTP,
            paymentTag,
        });
        const checkoutEl = createUnzerCheckoutEl(methodCode);

        node.appendChild(paymentEl);
        node.appendChild(checkoutEl);

        paymentElRef.current = paymentEl;
        checkoutElRef.current = checkoutEl;

        try {
            const snap = refreshUnzerFromContexts(paymentEl, cartCtx.cart, appCtx);
            beforeSnapshot?.(paymentEl, snap);
        } catch {}
    }, [isSelected, sdkReady, paymentTag]);

    useEffect(() => {
        mountUnzerElements();
        return () => {
            if (mountRef.current) mountRef.current.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [mountUnzerElements]);

    /**
     * Register default submit handler
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
            submittingRef.current = true;

            const checkoutEl = checkoutElRef.current;
            if (!checkoutEl) return false;

            try {
                setPageLoader(true);

                let submitResult;

                if (submitHandler) {
                    // CUSTOM submit
                    submitResult = await submitHandler({ checkoutEl, methodCode });
                } else {
                    // DEFAULT redirect submit
                    const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
                    checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();
                    const resourceId = await submitPromise;
                    submitResult = { resourceId };
                }

                // 2. Build payload
                const payload = {};
                if (!isLoggedIn) {
                    payload.login = { email: values?.login?.email || values?.email };
                }

                const additionalData = buildAdditionalData?.(submitResult, {
                    values,
                    appCtx,
                    cartCtx,
                }) ?? { resource_id: submitResult.resourceId };

                // 3. Perform place order
                await performPlaceOrder(payload, {
                    additionalData,
                });

                return true;
            } catch (err) {
                console.error('[BaseUnzerRedirect]', err);
                setErrorMessage(err?.message || 'Unable to process payment.');
                return false;
            } finally {
                setPageLoader(false);
                submittingRef.current = false;
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
                    }}
                />
            )}
        </div>
    );
}
