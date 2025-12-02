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

export default function UnzerKlarna({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_klarna';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();
    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    const sdkReady = useUnzerSdk({
        components: ['unzer-klarna'],
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
     * Build Klarna Customer Object
     */
    const buildCustomerData = () => {
        const billing = cartCtx?.billingAddress;
        const shipping = cartCtx?.shippingAddress || billing;

        if (!billing) {
            console.warn('[UnzerKlarna] Billing address missing.');
            return null;
        }

        return {
            firstname: billing.firstname || '',
            lastname: billing.lastname || '',
            email: appCtx.customer?.email || cartCtx.guestEmail,
            billingAddress: {
                name: `${billing.firstname || ''} ${billing.lastname || ''}`.trim(),
                street: Array.isArray(billing.street)
                    ? billing.street.join(' ')
                    : billing.street,
                zip: billing.postcode,
                city: billing.city,
                country: billing.countryId,
            },
            shippingAddress: {
                name: `${shipping.firstname || ''} ${shipping.lastname || ''}`.trim(),
                street: Array.isArray(shipping.street)
                    ? shipping.street.join(' ')
                    : shipping.street,
                zip: shipping.postcode,
                city: shipping.city,
                country: shipping.countryId,
            },
        };
    };

    /**
     * Build Klarna Basket Object
     */
    const buildBasketData = () => {
        const totals = cartCtx?.cart?.totals;
        if (!totals) return null;

        return {
            amount: totals.base_grand_total,
            currencyType: totals.base_currency_code,
        };
    };

    /**
     * Mount Klarna Elements
     */
    const mountUnzerElements = useCallback(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return;
        if (paymentElRef.current && checkoutElRef.current) return;

        const node = mountRef.current;
        node.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-klarna',
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        node.appendChild(unzerPaymentEl);
        node.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        // Set customer + basket data
        const customer = buildCustomerData();
        const basket = buildBasketData();

        if (customer && unzerPaymentEl.setCustomerData) {
            unzerPaymentEl.setCustomerData(customer);
        }

        if (basket && unzerPaymentEl.setBasketData) {
            unzerPaymentEl.setBasketData(basket);
        }

        // Safety fallback
        try {
            refreshUnzerFromContexts(unzerPaymentEl, cartCtx.cart, appCtx);
        } catch (e) {
            console.warn('[UnzerKlarna] snapshot failed', e);
        }

        unzerCheckoutEl.addEventListener('error', (e) => {
            console.error('KLARNA INTERNAL UI ERROR:', e.detail);
        });
    }, [isSelected, sdkReady, publicKey, locale]);

    useEffect(() => {
        mountUnzerElements();
        return () => {
            if (mountRef.current) mountRef.current.innerHTML = '';
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
                    setErrorMessage('Klarna form not ready.');
                    return false;
                }

                setPageLoader(true);

                // Submit Klarna UI
                const submitPromise = makeSubmitPromise(checkoutEl, { methodCode });
                submittingRef.current = true;

                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

                const resourceId = await submitPromise;

                if (!resourceId) {
                    setErrorMessage('Klarna could not generate payment type.');
                    return false;
                }

                // Backend place-order
                const payload = {};
                if (!appCtx.isLoggedIn) {
                    payload.login = {
                        email: values?.login?.email || values?.email,
                    };
                }

                await performPlaceOrder(payload, {
                    additionalData: {
                        resource_id: resourceId,
                    },
                });

                window.location.href = `${
                    window.BASE_URL || '/'
                }unzer/payment/redirect`;

                return true;
            } catch (err) {
                console.error('[UnzerKlarna Error]', err);
                setErrorMessage(err?.message || 'Unable to process Klarna payment.');
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

UnzerKlarna.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
