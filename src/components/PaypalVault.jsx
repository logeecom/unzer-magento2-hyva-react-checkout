/* eslint-disable */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes, { shape, func } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';

import { getCheckoutConfig } from '../utility/config';
import { paymentMethodShape } from '../../../../utils/payment';

export default function UnzerPayPalVault({ method, selected, actions }) {
    const { registerPaymentAction, values: checkoutValues } =
        useCheckoutFormContext();
    const { setErrorMessage, setPageLoader, isLoggedIn } = useAppContext();
    const cartCtx = useCartContext();

    const performPlaceOrder = usePerformPlaceOrderByREST(method.code);

    const [tokens, setTokens] = useState([]);
    const [selectedToken, setSelectedToken] = useState(null);

    /**
     * Load PayPal stored tokens
     */
    useEffect(() => {
        const cfg = getCheckoutConfig();
        const vault = cfg?.payment?.vault || {};

        const paypalTokens = Object.entries(vault)
            .filter(([key]) => key.startsWith('unzer_paypal_vault_'))
            .map(([key, value]) => ({
                code: key,
                config: value.config || {},
                gatewayToken: value.config?.details?.gatewayToken,
                publicHash: value.config?.publicHash || value.config?.pubLichash,
                details: value.config?.details || {},
            }))
            .filter((token) => token.gatewayToken && token.publicHash);

        console.log('[PayPalVault] Loaded tokens:', paypalTokens);
        setTokens(paypalTokens);
    }, []);

    /**
     * Main place-order handler
     */
    const placeOrderHandler = useCallback(async () => {
        console.log('[PayPalVault] placeOrderHandler triggered');

        if (!selectedToken) {
            setErrorMessage('Please select a PayPal account');
            return false;
        }

        const token = tokens.find((t) => t.code === selectedToken);
        const publicHash = token?.publicHash;
        const gatewayToken = token?.gatewayToken;

        console.log('[PayPalVault] Selected token:', token);
        console.log('[PayPalVault] Public hash:', publicHash);
        console.log('[PayPalVault] Gateway token:', gatewayToken);

        if (!publicHash) {
            setErrorMessage('Invalid stored PayPal token: missing public hash');
            return false;
        }

        if (!gatewayToken) {
            setErrorMessage('Invalid stored PayPal token: missing gateway token');
            return false;
        }

        try {
            setPageLoader(true);

            let placeOrderPayload = {};

            if (!isLoggedIn) {
                const email = checkoutValues?.login?.email || checkoutValues?.email;
                if (email) {
                    placeOrderPayload = {
                        login: { email },
                    };
                }
            }

            console.log('[PayPalVault] placeOrderPayload:', placeOrderPayload);

            await performPlaceOrder(placeOrderPayload, {
                additionalData: {
                    public_hash: publicHash,
                    resource_id: gatewayToken,
                    is_active_payment_token_enabler: '0',
                },
            });

            window.location.replace(
                `${window.BASE_URL || '/'}unzer/payment/redirect`
            );

            return true;
        } catch (err) {
            console.error('[PayPalVault] Place order failed:', err);
            console.error('[PayPalVault] Error details:', {
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
            });

            setErrorMessage(err?.message || 'Unable to process PayPal vault payment');
            return false;
        } finally {
            setPageLoader(false);
        }
    }, [
        selectedToken,
        tokens,
        performPlaceOrder,
        setPageLoader,
        setErrorMessage,
        isLoggedIn,
        checkoutValues,
    ]);

    /**
     * Stable handler
     */
    const handlerRef = useRef(placeOrderHandler);
    useEffect(() => {
        handlerRef.current = placeOrderHandler;
    }, [placeOrderHandler]);

    /**
     * Register placeOrder handler
     */
    useEffect(() => {
        const isSelected = selected?.code === method.code;

        if (isSelected) {
            const stableHandler = async () => {
                return handlerRef.current();
            };

            console.log(
                `[PayPalVault] Registering payment handler for ${method.code}`
            );
            registerPaymentAction(method.code, stableHandler);

            return () => {
                console.log(
                    `[PayPalVault] Unregistering payment handler for ${method.code}`
                );
                registerPaymentAction(method.code, undefined);
            };
        }
    }, [method.code, selected?.code, registerPaymentAction]);

    /**
     * Deselect stored token when switching payment method
     */
    useEffect(() => {
        if (selected?.code !== method.code && selectedToken) {
            console.log('[PayPalVault] Deselecting token due to method change');
            setSelectedToken(null);
        }
    }, [selected?.code, method.code, selectedToken]);

    /**
     * User selects stored token
     */
    const handleSelect = useCallback(
        (tokenCode) => {
            console.log('[PayPalVault] User selected token:', tokenCode);
            setSelectedToken(tokenCode);

            actions.change({
                target: { value: method.code },
            });
        },
        [method.code, actions]
    );

    if (tokens.length === 0) {
        return (
            <div style={{ padding: '1rem', color: '#666' }}>
                No saved PayPal accounts found.
            </div>
        );
    }

    const isMethodSelected = selected?.code === method.code;

    return (
        <div style={{ display: 'grid', gap: '1rem', padding: '0.5rem 0' }}>
            <div
                style={{
                    fontSize: '0.875rem',
                    color: '#666',
                    marginBottom: '0.5rem',
                    fontStyle: 'italic',
                }}
            />

            {tokens.map((token) => {
                const details = token.details || token.config?.details;
                if (!details) return null;

                const email = details.payerEmail || 'PayPal Account';
                const label = `PayPal (${email})`;

                const checked = isMethodSelected && selectedToken === token.code;

                return (
                    <div
                        key={token.code}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <RadioInput
                            id={token.code}
                            name={`paymentMethod_vault_${method.code}`}
                            label={label}
                            value={token.code}
                            checked={checked}
                            onChange={() => handleSelect(token.code)}
                        />
                    </div>
                );
            })}
        </div>
    );
}

UnzerPayPalVault.propTypes = {
    method: paymentMethodShape.isRequired,
    selected: paymentMethodShape,
    actions: shape({
        change: func,
        complete: func,
    }).isRequired,
};
