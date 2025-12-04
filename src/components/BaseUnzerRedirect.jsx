/* eslint-disable */
import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';

import useUnzerSdk from '../hooks/useUnzerSdk';
import { getUnzerPublicKey, getLocale } from '../utility/config';

import {
    createUnzerPaymentEl,
    createUnzerCheckoutEl,
} from '../dom/createElements';

import useCartContext from '../../../../hook/useCartContext';
import useAppContext from '../../../../hook/useAppContext';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import { refreshUnzerFromContexts } from '../utility/snapshot';

/**
 * Base component for redirect-based Unzer payment methods.
 */
export default function BaseUnzerRedirect({
                                              method,
                                              selected,
                                              actions,
                                              paymentTag,
                                              onPlaceOrder,
                                              beforeSnapshot,
                                          }) {
    const methodCode = method?.code || '';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();
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

    const onPlaceOrderRef = useRef(onPlaceOrder);
    onPlaceOrderRef.current = onPlaceOrder;

    /**
     * Mount <unzer-payment> + <unzer-checkout>
     */
    const mountUnzerElements = useCallback(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;

        paymentElRef.current = null;
        checkoutElRef.current = null;

        const node = mountRef.current;
        node.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag,
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        node.appendChild(unzerPaymentEl);
        node.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        try {
            const snap = refreshUnzerFromContexts(
                unzerPaymentEl,
                cartCtx.cart,
                appCtx
            );
            if (beforeSnapshot) beforeSnapshot(unzerPaymentEl, snap);
        } catch {}
    }, [isSelected, sdkReady, paymentTag]);

    /**
     * Mount + cleanup
     */
    useEffect(() => {
        mountUnzerElements();

        return () => {
            if (mountRef.current) mountRef.current.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [mountUnzerElements]);

    /**
     * Register handler only once per selection
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

            try {
                const checkoutEl = checkoutElRef.current;
                return await onPlaceOrderRef.current({
                    values,
                    checkoutEl,
                    methodCode,
                });
            } finally {
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
                        minHeight: 160,
                    }}
                />
            )}
        </div>
    );
}
