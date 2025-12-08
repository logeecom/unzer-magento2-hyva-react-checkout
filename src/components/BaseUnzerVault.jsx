/* eslint-disable */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes, { shape, func } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import useAppContext from '../../../../hook/useAppContext';
import useUnzerPerformPlaceOrder from '../hooks/useUnzerPlaceOrder';

import { getCheckoutConfig } from '../utility/config';
import { paymentMethodShape } from '../../../../utils/payment';

export default function BaseUnzerVault({
  method,
  selected,
  actions,
  tokenPrefix,
  buildLabel,
}) {
  const methodCode = method?.code;
  const { registerPaymentAction, values: checkoutValues } =
    useCheckoutFormContext();

  const { setErrorMessage, setPageLoader, isLoggedIn } = useAppContext();
  const performPlaceOrder = useUnzerPerformPlaceOrder(methodCode);

  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);

  // Load vault tokens
  useEffect(() => {
    const cfg = getCheckoutConfig();
    const vault = cfg?.payment?.vault || {};

    const loaded = Object.entries(vault)
      .filter(([key]) => key.startsWith(tokenPrefix))
      .map(([key, value]) => ({
        code: key,
        config: value.config || {},
        gatewayToken: value.config?.details?.gatewayToken,
        publicHash: value.config?.publicHash || value.config?.pubLichash,
        details: value.config?.details || {},
      }))
      .filter((t) => t.gatewayToken && t.publicHash);

    console.log(`[Vault] Loaded (${methodCode}):`, loaded);
    setTokens(loaded);
  }, [methodCode, tokenPrefix]);

  // Main place-order handler
  const placeOrderHandler = useCallback(async () => {
    console.log(`[${methodCode} Vault] placeOrderHandler triggered`);

    if (!selectedToken) {
      setErrorMessage('Please select a stored payment method');
      return false;
    }

    const token = tokens.find((t) => t.code === selectedToken);
    const publicHash = token?.publicHash;
    const gatewayToken = token?.gatewayToken;

    if (!publicHash || !gatewayToken) {
      setErrorMessage('Invalid stored token');
      return false;
    }

    try {
      setPageLoader(true);

      let payload = {};
      if (!isLoggedIn) {
        const email = checkoutValues?.login?.email || checkoutValues?.email;
        if (email) payload = { login: { email } };
      }

      await performPlaceOrder(payload, {
        additionalData: {
          public_hash: publicHash,
          resource_id: gatewayToken,
          is_active_payment_token_enabler: '0',
        },
      });

      return true;
    } catch (err) {
      console.error(`[${methodCode} Vault] Error:`, err);
      setErrorMessage(err?.message || 'Unable to process vault payment');
      return false;
    } finally {
      setPageLoader(false);
    }
  }, [
    selectedToken,
    tokens,
    isLoggedIn,
    checkoutValues,
    performPlaceOrder,
    setErrorMessage,
    setPageLoader,
  ]);

  // register stable place-order handler
  const handlerRef = useRef(placeOrderHandler);
  useEffect(() => {
    handlerRef.current = placeOrderHandler;
  }, [placeOrderHandler]);

  useEffect(() => {
    const isSelected = selected?.code === methodCode;

    if (isSelected) {
      registerPaymentAction(methodCode, () => handlerRef.current());
      return () => registerPaymentAction(methodCode, undefined);
    }
  }, [selected?.code, methodCode, registerPaymentAction]);

  // Unselect token when switching
  useEffect(() => {
    if (selected?.code !== methodCode && selectedToken) {
      setSelectedToken(null);
    }
  }, [selected?.code, methodCode, selectedToken]);

  // No tokens available
  if (tokens.length === 0) {
    return (
      <div style={{ padding: '1rem', color: '#666' }}>No saved methods.</div>
    );
  }

  const isMethodSelected = selected?.code === methodCode;

  return (
    <div style={{ display: 'grid', gap: '1rem', padding: '0.5rem 0' }}>
      {tokens.map((token) => {
        const label = buildLabel(token);
        const checked = isMethodSelected && selectedToken === token.code;

        return (
          <div
            key={token.code}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <RadioInput
              id={token.code}
              name={`paymentMethod_vault_${methodCode}`}
              label={label}
              value={token.code}
              checked={checked}
              onChange={() => {
                setSelectedToken(token.code);
                actions.change({ target: { value: methodCode } });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

BaseUnzerVault.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape,
  actions: shape({
    change: func,
    complete: func,
  }).isRequired,
  tokenPrefix: PropTypes.string.isRequired,
  buildLabel: PropTypes.func.isRequired,
};
