import React, { useCallback } from 'react';
import { shape, func } from 'prop-types';
import { paymentMethodShape } from '../../../../utils/payment';

import BaseUnzerRedirect from './BaseUnzerRedirect';
import { getCheckoutConfig } from '../utility/config';
import useHidePlaceOrderForWalletMethods from '../hooks/useHidePlaceOrderButton';

export default function UnzerGooglePay({ method, selected, actions }) {
    const methodCode = method?.code || 'unzer_googlepay';
    const isSelected = methodCode === selected?.code;
    const cfg = getCheckoutConfig();
    const googlePayCfg = cfg.payment[methodCode];

    useHidePlaceOrderForWalletMethods(isSelected, methodCode);

    const beforeSnapshot = useCallback(
        (paymentEl, snap) => {
            if (!paymentEl || !googlePayCfg) return;

            // Set Google Pay data
            const setGooglePayData = async () => {
                const maxRetries = 10;
                const interval = 500;

                return new Promise((resolve, reject) => {
                    let retries = 0;

                    const trySetData = () => {
                        if (paymentEl && typeof paymentEl.setGooglePayData === 'function') {
                            paymentEl.setGooglePayData({
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
                            resolve(true);
                        } else if (retries < maxRetries) {
                            retries += 1;
                            console.warn(
                                `[Unzer GooglePay] Element not ready yet → retrying... (${retries}/${maxRetries})`
                            );
                            setTimeout(trySetData, interval);
                        } else {
                            reject(new Error('Google Pay element not ready'));
                        }
                    };

                    trySetData();
                });
            };

            setGooglePayData().catch((err) => {
                console.error('[Unzer GooglePay] Failed to set Google Pay data:', err);
            });
        },
        [googlePayCfg]
    );

    return (
        <BaseUnzerRedirect
            method={method}
            selected={selected}
            actions={actions}
            paymentTag="unzer-google-pay"
            beforeSnapshot={beforeSnapshot}
        />
    );
}

UnzerGooglePay.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape.isRequired,
    actions: shape({ change: func }).isRequired,
};
