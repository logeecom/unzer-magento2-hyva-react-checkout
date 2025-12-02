/* eslint-disable */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { shape, func } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import { paymentMethodShape } from '../../../../utils/payment';

import useUnzerSdk from '../hooks/useUnzerSdk';
import {
    getUnzerPublicKey,
    getLocale,
    getCheckoutConfig,
} from '../utility/config';

import {
    createUnzerPaymentEl,
    createUnzerCheckoutEl,
} from '../dom/createElements';

import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import { refreshUnzerFromContexts } from '../utility/snapshot';

export default function UnzerGooglePay({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_googlepay';
    const isSelected = methodCode === selected?.code;

    const cfg = getCheckoutConfig();
    const googlePayCfg = cfg.payment[methodCode];

    const { registerPaymentAction } = useCheckoutFormContext();
    const performPlaceOrder = usePerformPlaceOrderByREST(methodCode);

    const cartCtx = useCartContext();
    const appCtx = useAppContext();
    const { setErrorMessage, setPageLoader } = appCtx;

    const sdkReady = useUnzerSdk({
        components: ['unzer-google-pay'],
        waitForCheckout: true,
    });

    const publicKey = getUnzerPublicKey(methodCode);
    const locale = getLocale();

    // DOM refs
    const mountRef = useRef(null);
    const paymentElRef = useRef(null);
    const checkoutElRef = useRef(null);

    const submittingRef = useRef(false);
    const registeredRef = useRef(false);

    // Store data like Luma does
    const resourceIdRef = useRef(null);
    const customerIdRef = useRef(null);
    const threatMetrixIdRef = useRef(null);

    // Configure Google Pay data with retry logic
    const setGooglePayData = useCallback(
        async (maxRetries = 10, interval = 500) => {
            return new Promise((resolve, reject) => {
                let retries = 0;

                const trySetData = () => {
                    const gpEl = document.querySelector(`#unzer-payment-${methodCode}`);

                    if (gpEl && typeof gpEl.setGooglePayData === 'function') {
                        const currency = cfg.currency.code;
                        const total = cartCtx.cart.prices.grandTotalAmount;

                        gpEl.setGooglePayData({
                            gatewayMerchantId: googlePayCfg.unzer_channel_id,
                            merchantInfo: {
                                merchantId: googlePayCfg.merchant_id,
                                merchantName: googlePayCfg.merchant_name,
                            },
                            transactionInfo: {
                                countryCode: googlePayCfg.country_code,
                                currencyCode: currency,
                                totalPrice: String(total),
                            },
                            buttonOptions: {
                                buttonColor: googlePayCfg.button_color,
                                buttonRadius: googlePayCfg.button_border_radius,
                                buttonSizeMode: googlePayCfg.button_size_mode,
                            },
                            allowedCardNetworks: googlePayCfg.allowed_card_networks || [],
                            allowCreditCards: googlePayCfg.allow_credit_cards === '1',
                            allowPrepaidCards: googlePayCfg.allow_prepaid_cards === '1',
                        });
                        console.log('[Unzer GooglePay] Google Pay data set successfully');
                        resolve(true);
                    } else if (retries < maxRetries) {
                        retries++;
                        console.warn(
                            `[Unzer GooglePay] Element not ready yet → retrying... (${retries}/${maxRetries})`
                        );
                        setTimeout(trySetData, interval);
                    } else {
                        console.error(
                            '[Unzer GooglePay] Failed to set Google Pay data after multiple retries'
                        );
                        reject(new Error('Google Pay element not ready'));
                    }
                };

                trySetData();
            });
        },
        [cartCtx?.cart?.prices, cfg, googlePayCfg, methodCode]
    );

    // SET CUSTOMER DATA
    const setCustomerAndBasketData = useCallback(
        async (maxRetries = 10, interval = 500) => {
            return new Promise((resolve, reject) => {
                let retries = 0;

                const trySetData = () => {
                    const unzerPaymentEl = document.querySelector(
                        `#unzer-payment-${methodCode}`
                    );

                    if (
                        unzerPaymentEl &&
                        typeof unzerPaymentEl.setBasketData === 'function' &&
                        typeof unzerPaymentEl.setCustomerData === 'function'
                    ) {
                        // Set basket data
                        unzerPaymentEl.setBasketData({
                            amount: cartCtx.cart.prices.grandTotalAmount,
                            currencyType: cfg.currency.code,
                        });

                        // Set customer data
                        const billing = cartCtx.cart?.billing_address;
                        const shipping = cartCtx.cart?.shipping_address;

                        const customer = {
                            firstname: billing?.firstname || '',
                            lastname: billing?.lastname || '',
                            email: cartCtx.cart?.email || '',
                            billingAddress: billing
                                ? {
                                    name: `${billing.firstname || ''} ${
                                        billing.lastname || ''
                                    }`.trim(),
                                    street: Array.isArray(billing.street)
                                        ? billing.street.join(' ')
                                        : billing.street || '',
                                    zip: billing.zipcode || '',
                                    city: billing.city || '',
                                    country: billing.country || '',
                                }
                                : {},
                            shippingAddress: shipping
                                ? {
                                    name: `${shipping.firstname || ''} ${
                                        shipping.lastname || ''
                                    }`.trim(),
                                    street: Array.isArray(shipping.street)
                                        ? shipping.street.join(' ')
                                        : shipping.street || '',
                                    zip: shipping.zipcode || '',
                                    city: shipping.city || '',
                                    country: shipping.country || '',
                                }
                                : {},
                            customerSettings: {
                                type:
                                    billing?.company && billing.company.trim() !== ''
                                        ? 'B2B'
                                        : 'B2C',
                            },
                        };

                        // Add company if present
                        if (billing?.company && billing.company.trim() !== '') {
                            customer.company = billing.company.trim();
                        }

                        console.log('[Unzer GooglePay] Setting customer data:', customer);
                        unzerPaymentEl.setCustomerData(customer);

                        resolve(true);
                    } else if (retries < maxRetries) {
                        retries++;
                        console.warn(
                            `[Unzer GooglePay] Customer/Basket data functions not ready → retrying... (${retries}/${maxRetries})`
                        );
                        setTimeout(trySetData, interval);
                    } else {
                        console.error(
                            '[Unzer GooglePay] Failed to set customer/basket data after multiple retries'
                        );
                        reject(new Error('Customer/Basket data functions not ready'));
                    }
                };

                trySetData();
            });
        },
        [cartCtx.cart, appCtx.customer, cfg.currency.code, methodCode]
    );

    // Place order function
    const handlePlaceOrder = useCallback(
        async (resourceId, values = {}) => {
            if (submittingRef.current) {
                console.log('[Unzer GooglePay] Already submitting, skipping...');
                return false;
            }

            try {
                console.log(
                    '[Unzer GooglePay] Placing order with resourceId:',
                    resourceId
                );
                setPageLoader(true);
                submittingRef.current = true;

                // Prepare payload
                const payload = {};
                if (!appCtx.isLoggedIn) {
                    payload.login = {
                        email: values?.login?.email || values?.email,
                    };
                }

                // Build additional data
                const additionalData = {
                    resource_id: resourceId,
                };

                // Add customer data if available
                if (customerIdRef.current) {
                    additionalData.customer_id = customerIdRef.current;
                }

                // Add threatMetrix if available
                if (threatMetrixIdRef.current) {
                    additionalData.threat_metrix_id = threatMetrixIdRef.current;
                }

                // Add customer type
                const billing = cartCtx.cart?.billingAddress;
                additionalData.customer_type =
                    billing?.company && billing.company.trim() !== '' ? 'B2B' : 'B2C';

                console.log(
                    '[Unzer GooglePay] Placing order with data:',
                    additionalData
                );

                // Place the order
                const response = await performPlaceOrder(payload, {
                    additionalData: additionalData,
                });

                console.log('[Unzer GooglePay] Order response:', response);

                // Handle redirect
                const redirectUrl =
                    response?.redirect_url ||
                    response?.response?.redirect_url ||
                    `${window.BASE_URL || '/'}unzer/payment/redirect`;

                console.log('[Unzer GooglePay] Redirecting to:', redirectUrl);
                window.location.href = redirectUrl;

                return true;
            } catch (err) {
                console.error('[Unzer GooglePay] Payment error:', err);
                setErrorMessage(
                    err?.message || 'Unable to process Google Pay payment.'
                );
                return false;
            } finally {
                submittingRef.current = false;
                setPageLoader(false);
            }
        },
        [
            performPlaceOrder,
            setPageLoader,
            setErrorMessage,
            appCtx.isLoggedIn,
            cartCtx.cart,
        ]
    );

    // Mount Unzer elements
    useEffect(() => {
        if (!isSelected || !sdkReady || !mountRef.current) return () => {};

        const mountNode = mountRef.current;
        mountNode.innerHTML = '';

        // Reset refs
        resourceIdRef.current = null;
        customerIdRef.current = null;
        threatMetrixIdRef.current = null;

        // <unzer-payment>
        const unzerPaymentEl = createUnzerPaymentEl({
            methodCode,
            publicKey,
            locale,
            paymentTag: 'unzer-google-pay',
        });

        // <unzer-checkout>
        const unzerCheckoutEl = createUnzerCheckoutEl(methodCode);

        // Handle everything in onPaymentSubmit
        unzerCheckoutEl.onPaymentSubmit = async (response) => {
            console.log('[Unzer GooglePay] onPaymentSubmit called:', response);

            // Store customer data if available
            if (response.customerResponse?.success) {
                customerIdRef.current = response.customerResponse.data.id;
                console.log('[Unzer GooglePay] Customer ID:', customerIdRef.current);
            }

            // Store threatMetrix if available
            if (response.threatMetrixId) {
                threatMetrixIdRef.current = response.threatMetrixId;
                console.log(
                    '[Unzer GooglePay] ThreatMetrix ID:',
                    threatMetrixIdRef.current
                );
            }

            // Check if this is the payment submission response
            if (response.submitResponse?.success) {
                const resourceId = response.submitResponse.data.id;
                console.log(
                    '[Unzer GooglePay] Payment successful, resourceId:',
                    resourceId
                );

                // Store data
                resourceIdRef.current = resourceId;
                unzerCheckoutEl.dataset.resourceId = resourceId;

                try {
                    // Call placeOrder immediately
                    const success = await handlePlaceOrder(resourceId);

                    if (success) {
                        return { status: 'success' };
                    } else {
                        return { status: 'error', message: 'Failed to place order' };
                    }
                } catch (error) {
                    console.error('[Unzer GooglePay] Error in onPaymentSubmit:', error);
                    return { status: 'error', message: error.message };
                }
            }

            if (response.customerResponse?.success) {
                console.log(
                    '[Unzer GooglePay] Customer created, waiting for payment submission...'
                );
                return { status: 'success' };
            }

            console.error('[Unzer GooglePay] Payment submission failed:', response);
            return {
                status: 'error',
                message:
                    response.submitResponse?.message || 'Payment authentication failed',
            };
        };

        mountNode.appendChild(unzerPaymentEl);
        mountNode.appendChild(unzerCheckoutEl);

        paymentElRef.current = unzerPaymentEl;
        checkoutElRef.current = unzerCheckoutEl;

        refreshUnzerFromContexts(unzerPaymentEl, cartCtx?.cart, appCtx);

        // Wait for custom element to be defined AND then set all required data
        const initializeGooglePay = async () => {
            try {
                console.log(
                    '[Unzer GooglePay] Waiting for custom element to be defined...'
                );

                // Wait for the custom element to be defined
                await customElements.whenDefined('unzer-google-pay');

                console.log(
                    '[Unzer GooglePay] Custom element defined, setting up data...'
                );

                // Small additional delay to ensure element is fully ready
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Set customer and basket data FIRST
                await setCustomerAndBasketData();

                // Then set Google Pay data
                await setGooglePayData();

                console.log('[Unzer GooglePay] Google Pay initialization complete');
            } catch (error) {
                console.error(
                    '[Unzer GooglePay] Failed to initialize Google Pay:',
                    error
                );
                setErrorMessage('Failed to initialize Google Pay. Please try again.');
            }
        };

        initializeGooglePay();

        return () => {
            mountNode.innerHTML = '';
            paymentElRef.current = null;
            checkoutElRef.current = null;
        };
    }, [
        isSelected,
        sdkReady,
        publicKey,
        locale,
        methodCode,
        cartCtx?.cart,
        appCtx,
        setGooglePayData,
        setCustomerAndBasketData,
        setErrorMessage,
        handlePlaceOrder,
    ]);

    // Register Hyvä place-order handler
    useEffect(() => {
        if (!isSelected) {
            registerPaymentAction(methodCode, undefined);
            submittingRef.current = false;
            registeredRef.current = false;
            return;
        }

        if (registeredRef.current) return;

        // For Google Pay, the place order is handled inside onPaymentSubmit
        // This handler just prevents the default Hyvä place order behavior
        const handler = async (values) => {
            console.log(
                '[Unzer GooglePay] Hyvä place order called - Google Pay handles this internally'
            );
            return false;
        };

        registerPaymentAction(methodCode, handler);
        registeredRef.current = true;
        console.log(
            '[Unzer GooglePay] Payment handler registered (Google Pay internal flow)'
        );
    }, [isSelected, methodCode, registerPaymentAction]);

    // RENDER
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
                <>
                    <div
                        id={`unzer-mount-${methodCode}`}
                        ref={mountRef}
                        style={{
                            marginTop: 12,
                            display: 'grid',
                            gap: '1rem',
                            minHeight: 160,
                            position: 'relative',
                        }}
                    />

                    <div id="google-pay-container" />
                </>
            )}
        </div>
    );
}

UnzerGooglePay.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
