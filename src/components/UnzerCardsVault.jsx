/* eslint-disable */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes, { func, shape } from 'prop-types';

import RadioInput from '../../../../components/common/Form/RadioInput';
import usePerformPlaceOrderByREST from '../../../../hook/usePerformPlaceOrderByREST';
import useCheckoutFormContext from '../../../../hook/useCheckoutFormContext';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';

import { getCheckoutConfig } from '../utility/config';
import { paymentMethodShape } from '../../../../utils/payment';

export default function UnzerCardsVault({ method, selected, actions }) {
  const { registerPaymentAction, values: checkoutValues } =
      useCheckoutFormContext();
  const { setErrorMessage, setPageLoader, isLoggedIn } = useAppContext();
  const cartCtx = useCartContext();

  const performPlaceOrder = usePerformPlaceOrderByREST(method.code);

  const [vaultCards, setVaultCards] = useState([]);
  const [selectedCardCode, setSelectedCardCode] = useState(null);

  /**
   * Load vault cards from checkoutConfig
   */
  useEffect(() => {
    const cfg = getCheckoutConfig();
    const vault = cfg?.payment?.vault || {};

    const cards = Object.entries(vault)
        .filter(([key]) => key.startsWith('unzer_cards_vault_'))
        .map(([key, value]) => ({
          code: key,
          config: value.config || {},
          gatewayToken: value.config?.details?.gatewayToken,
          publicHash: value.config?.publicHash || value.config?.pubLichash,
          details: value.config?.details || {},
        }))
        .filter((card) => card.gatewayToken && card.publicHash);

    console.log('[Vault] Loaded cards:', cards);
    setVaultCards(cards);
  }, []);

  /**
   * Main place-order handler
   */
  const placeOrderHandler = useCallback(async () => {
    console.log('[Vault] placeOrderHandler triggered');

    if (!selectedCardCode) {
      setErrorMessage('Please select a stored card');
      return false;
    }

    const card = vaultCards.find((c) => c.code === selectedCardCode);
    const publicHash = card?.publicHash;
    const gatewayToken = card?.gatewayToken;

    console.log('[Vault] Selected card:', card);
    console.log('[Vault] Public hash:', publicHash);
    console.log('[Vault] Gateway token:', gatewayToken);

    if (!publicHash) {
      setErrorMessage('Invalid stored card: missing public hash');
      return false;
    }

    if (!gatewayToken) {
      setErrorMessage('Invalid stored card: missing gateway token');
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

      console.log('[Vault] placeOrderPayload:', placeOrderPayload);

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
      console.error('[Vault] Place order failed:', err);
      console.error('[Vault] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });

      setErrorMessage(err?.message || 'Unable to process stored card payment');
      return false;
    } finally {
      setPageLoader(false);
    }
  }, [
    selectedCardCode,
    vaultCards,
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

      console.log(`[Vault] Registering payment handler for ${method.code}`);
      registerPaymentAction(method.code, stableHandler);

      return () => {
        console.log(`[Vault] Unregistering payment handler for ${method.code}`);
        registerPaymentAction(method.code, undefined);
      };
    }
  }, [method.code, selected?.code, registerPaymentAction]);

  /**
   * Deselect stored card when switching payment method
   */
  useEffect(() => {
    if (selected?.code !== method.code && selectedCardCode) {
      console.log('[Vault] Deselecting card due to method change');
      setSelectedCardCode(null);
    }
  }, [selected?.code, method.code, selectedCardCode]);

  /**
   * User selects stored card
   */
  const handleCardSelection = useCallback(
      (cardCode) => {
        console.log('[Vault] Card selected:', cardCode);
        setSelectedCardCode(cardCode);

        actions.change({
          target: { value: method.code },
        });
      },
      [method.code, actions]
  );

  if (vaultCards.length === 0) {
    return (
        <div style={{ padding: '1rem', color: '#666' }}>
          No stored cards available.
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

        {vaultCards.map((card) => {
          const details = card.details || card.config?.details;
          if (!details) return null;

          const masked =
              details?.maskedCC || details?.maskedCc || '**** **** **** ****';
          const last4 = masked.slice(-4);
          const label = `${details.cardBrand || 'Card'} •••• ${last4} (expires ${
              details.formattedExpirationDate || 'MM/YY'
          })`;

          const checked = isMethodSelected && selectedCardCode === card.code;

          return (
              <div
                  key={card.code}
                  style={{ display: 'flex', alignItems: 'center' }}
              >
                <RadioInput
                    id={card.code}
                    name={`paymentMethod_vault_${method.code}`}
                    label={label}
                    value={card.code}
                    checked={checked}
                    onChange={() => handleCardSelection(card.code)}
                />
              </div>
          );
        })}
      </div>
  );
}

UnzerCardsVault.propTypes = {
  method: paymentMethodShape.isRequired,
  selected: paymentMethodShape,
  actions: shape({
    change: func,
    complete: func,
  }).isRequired,
};
