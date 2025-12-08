/* eslint-disable */
import React, { useCallback } from 'react';
import { shape, func } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import { paymentMethodShape } from '../../../../utils/payment';

import { getCheckoutConfig } from '../utility/config';
import { buildSnapshot } from '../utility/snapshot';

import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import BaseUnzerWallet from './BaseUnzerWallet';

export default function UnzerGooglePay({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_googlepay';
    const isSelected = methodCode === selected?.code;

    const cfg = getCheckoutConfig();
    const googlePayCfg = cfg.payment[methodCode];

    const cartCtx = useCartContext();
    const appCtx = useAppContext();

    // Configure Google Pay data with retry logic
    const setGooglePayData = useCallback(
        async (unzerPaymentEl, maxRetries = 10, interval = 500) => {
            return new Promise((resolve, reject) => {
                let retries = 0;

                const trySetData = () => {
                    const gpEl = document.querySelector(`#unzer-payment-${methodCode}`);

                    if (gpEl && typeof gpEl.setGooglePayData === 'function') {
                        const snap = buildSnapshot(cartCtx.cart, appCtx);

                        gpEl.setGooglePayData({
                            gatewayMerchantId: googlePayCfg.unzer_channel_id,
                            merchantInfo: {
                                merchantId: googlePayCfg.merchant_id,
                                merchantName: googlePayCfg.merchant_name,
                            },
                            transactionInfo: {
                                countryCode: googlePayCfg.country_code,
                                currencyCode: snap.currency,
                                totalPrice: String(snap.grandTotal),
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
        [cartCtx.cart, appCtx, cfg, googlePayCfg, methodCode]
    );

    // SET CUSTOMER DATA using snapshot utility
    const setCustomerAndBasketData = useCallback(
        async (unzerPaymentEl, maxRetries = 10, interval = 500) => {
            return new Promise((resolve, reject) => {
                let retries = 0;

                const trySetData = () => {
                    const el = document.querySelector(`#unzer-payment-${methodCode}`);

                    if (
                        el &&
                        typeof el.setBasketData === 'function' &&
                        typeof el.setCustomerData === 'function'
                    ) {
                        const snap = buildSnapshot(cartCtx.cart, appCtx);

                        // Set basket data
                        el.setBasketData({
                            amount: snap.grandTotal,
                            currencyType: snap.currency,
                        });

                        // Set customer data
                        console.log(
                            '[Unzer GooglePay] Setting customer data:',
                            snap.customer
                        );
                        el.setCustomerData(snap.customer);

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
        [cartCtx.cart, appCtx, methodCode]
    );

    // Configure payment data callback
    const onConfigurePaymentData = useCallback(
        async (unzerPaymentEl) => {
            // Set customer and basket data FIRST
            await setCustomerAndBasketData(unzerPaymentEl);

            // Then set Google Pay data
            await setGooglePayData(unzerPaymentEl);
        },
        [setCustomerAndBasketData, setGooglePayData]
    );

    // Use base wallet component
    const { mountRef } = BaseUnzerWallet({
        methodCode,
        isSelected,
        paymentTag: 'unzer-google-pay',
        customElementName: 'unzer-google-pay',
        onConfigurePaymentData,
    });

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
