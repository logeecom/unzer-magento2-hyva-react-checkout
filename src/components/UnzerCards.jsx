/* eslint-disable */
/**
 * UnzerCards (display-only)
 *
 * - Loads the Unzer UI SDK via the useUnzerSdk hook
 * - Reads configuration from Hyvä’s data-checkout_config via utility/config
 * - Mounts <unzer-payment>, <unzer-card>, and optionally <unzer-checkout> elements
 */
import React, { useEffect, useRef, useState } from 'react';
import { shape, func } from 'prop-types';
import { paymentMethodShape } from '../../../../utils/payment';
import RadioInput from '../../../../components/common/Form/RadioInput';

import useUnzerSdk from '../hooks/useUnzerSdk';
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
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import {
    buildSnapshot,
    primeBasketAndCustomerData,
    refreshUnzerFromContexts,
} from '../utility/snapshot';

export default function UnzerCards({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_cards';
    const isSelected = methodCode === selected?.code;

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);
    const { setPageLoader, setErrorMessage } = useAppContext();

    // Wait until Unzer SDK is ready
    const sdkReady = useUnzerSdk({
        components: ['unzer-card'],
        waitForCheckout: true,
    });

    // Read config values
    const publicKey = getUnzerPublicKey(methodCode);
    const locale = getLocale();
    const enableCTP = getEnableClickToPay(methodCode);

    // DOM refs
    const mountRef = useRef(null);
    const paymentElRef = useRef(null);
    const checkoutElRef = useRef(null);

    // Guard refs to prevent duplicate submissions
    const submittingRef = useRef(false);
    const inflightRef = useRef(null);
    const registeredRef = useRef(false);

    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        console.log('[UnzerCards] Mount effect triggered', {
            isSelected,
            sdkReady,
            hasMounted,
            mountRef: !!mountRef.current,
        });

        if (!isSelected || !sdkReady || !mountRef.current) {
            return;
        }

        console.log('[UnzerCards] Mounting Unzer UI elements');

        mountRef.current.innerHTML = '';

        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            enableCTP,
            paymentTag: 'unzer-card',
        });

        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        mountRef.current.appendChild(unzerPaymentEl);
        mountRef.current.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        setHasMounted(true);

        refreshUnzerFromContexts(paymentElRef.current, cartCtx.cart, appCtx);

        return () => {
            if (!isSelected) {
                console.log('[UnzerCards] Cleaning up (payment method deselected)');
                if (mountRef.current) {
                    mountRef.current.innerHTML = '';
                }
                paymentElRef.current = null;
                checkoutElRef.current = null;
                setHasMounted(false);
            }
        };
    }, [isSelected, sdkReady, publicKey, locale, enableCTP, methodCode]);

    useEffect(() => {
        if (isSelected && sdkReady && mountRef.current && !paymentElRef.current) {
            console.log(
                '[UnzerCards] Elements missing but should be mounted, re-mounting...'
            );

            const timer = setTimeout(() => {
                if (mountRef.current && isSelected) {
                    mountRef.current.innerHTML = '';

                    const unzerPaymentEl = createUnzerPaymentEl({
                        methodCode,
                        publicKey,
                        locale,
                        enableCTP,
                        paymentTag: 'unzer-card',
                    });

                    const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

                    mountRef.current.appendChild(unzerPaymentEl);
                    mountRef.current.appendChild(unzerCheckoutEl);

                    paymentElRef.current = unzerPaymentEl;
                    checkoutElRef.current = unzerCheckoutEl;
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isSelected, sdkReady, mountRef.current]);

    // Register payment handler for Hyvä React Checkout
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
            if (submittingRef.current) {
                console.warn(
                    '[UnzerCards] submit in progress or stuck – skipping duplicate call.'
                );
                return false;
            }

            const saveCardCheckbox = document.getElementById(
                'unzer-card-save-card-checkbox'
            );
            const shouldSaveCard = saveCardCheckbox?.checked === true;

            try {
                const checkoutEl = checkoutElRef.current;
                if (!checkoutEl) throw new Error('Unzer checkout element not ready.');

                const unzerBtn =
                    checkoutEl.shadowRoot?.querySelector('button') ||
                    checkoutEl.querySelector('button');

                if (unzerBtn?.disabled) {
                    setErrorMessage(
                        'Please fill in all payment details before placing the order.'
                    );
                    return false;
                }

                setPageLoader(true);

                if (paymentElRef.current) {
                    paymentElRef.current.setAttribute(
                        'card-detail-mode',
                        shouldSaveCard ? 'store' : 'none'
                    );
                }

                const submitPromise = makeSubmitPromise(checkoutEl, {
                    methodCode,
                });

                submittingRef.current = true;
                inflightRef.current = submitPromise;

                checkoutEl.querySelector(`#unzer-submit-${methodCode}`)?.click();

                const resourceId = await submitPromise;

                let placeOrderPayload;
                if (appCtx.isLoggedIn) {
                    placeOrderPayload = {};
                } else {
                    placeOrderPayload = {
                        login: {
                            email: values?.login?.email || values?.email,
                        },
                    };
                }

                await performPlaceOrder(placeOrderPayload, {
                    additionalData: {
                        resource_id: resourceId,
                        is_active_payment_token_enabler: shouldSaveCard ? '1' : '0',
                    },
                });

                window.location.replace(
                    `${window.BASE_URL || '/'}unzer/payment/redirect`
                );

                return true;
            } catch (err) {
                console.error('[UnzerCards] Unzer/payment flow failed:', err);
                setErrorMessage(
                    err?.message || 'This transaction could not be performed.'
                );
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
                    key={`unzer-mount-${methodCode}-${
                        isSelected ? 'selected' : 'deselected'
                    }`}
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
                    htmlFor="unzer-card-save-card-checkbox"
                    style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        marginTop: '0.5rem',
                    }}
                >
                    <input type="checkbox" id="unzer-card-save-card-checkbox" />
                    <span id="unzer-card-save-card-typography">Save for later use.</span>
                </label>
            )}
        </div>
    );
}

UnzerCards.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({
        change: func,
    }).isRequired,
};
