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

export default function UnzerPrepayment({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_prepayment';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-prepayment'],
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
     * Mount Unzer form
     */
    useEffect(() => {
        if (!isSelected || !sdkReady || !mountRef.current) {
            return undefined;
        }

        const mountNode = mountRef.current;
        mountNode.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-prepayment',
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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSelected, sdkReady, publicKey, locale]);

    /**
     * Register handler
     */
    useEffect(() => {
        if (!isSelected) {
            registerPaymentAction(methodCode, undefined);
            registeredRef.current = false;
            submittingRef.current = false;
            inflightRef.current = null;
            return undefined;
        }

        if (registeredRef.current) return undefined;

        const handler = async (values) => {
            if (submittingRef.current) return false;

            let success = false;

            try {
                const checkoutEl = checkoutElRef.current;
                if (!checkoutEl) {
                    setErrorMessage('Prepayment form not ready.');
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

                const resp = await performPlaceOrder(payload, {
                    additionalData: { resource_id: resourceId },
                });

                // eslint-disable-next-line no-console
                console.log(resp);

                window.location.replace(
                    `${window.BASE_URL || '/'}unzer/payment/redirect`
                );

                success = true;
            } catch (err) {
                console.error('[UnzerPrepayment] error:', err);
                setErrorMessage(err?.message || 'Cannot process prepayment.');
                success = false;
            } finally {
                submittingRef.current = false;
                inflightRef.current = null;
                setPageLoader(false);
            }

            return success;
        };

        registerPaymentAction(methodCode, handler);
        registeredRef.current = true;

        return () => {
            registerPaymentAction(methodCode, undefined);
            registeredRef.current = false;
            submittingRef.current = false;
            inflightRef.current = null;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                        gap: '0.75rem',
                        minHeight: 160,
                    }}
                />
            )}
        </div>
    );
}

UnzerPrepayment.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
