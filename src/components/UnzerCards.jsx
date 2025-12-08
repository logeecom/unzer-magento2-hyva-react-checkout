/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';
import useAppContext from '../../../../hook/useAppContext';
import usePaymentMethodCartContext from '../../../../components/paymentMethod/hooks/usePaymentMethodCartContext';

export default function UnzerCards(props) {
    const methodCode = props.method?.code || 'unzer_cards';
    const { isLoggedIn } = useAppContext();
    const { methodList } = usePaymentMethodCartContext();
    const isEnabled = !!methodList['unzer_cards_vault'];

    const beforeSnapshot = (paymentEl) => {
        const shouldSave = document.getElementById(
            `cards-save-${methodCode}`
        )?.checked;

        paymentEl.setAttribute('card-detail-mode', shouldSave ? 'store' : 'none');
    };

    const buildAdditionalData = (submitResult) => {
        const shouldSave = document.getElementById(
            `cards-save-${methodCode}`
        )?.checked;

        return {
            resource_id: submitResult.resourceId,
            is_active_payment_token_enabler: shouldSave ? '1' : '0',
        };
    };

    return (
        <div>
            <BaseUnzerRedirect
                {...props}
                paymentTag="unzer-card"
                beforeSnapshot={beforeSnapshot}
                buildAdditionalData={buildAdditionalData}
            />

            {isLoggedIn &&
                isEnabled &&
                props.selected?.code === props.method?.code && (
                    <label
                        htmlFor={`cards-save-${methodCode}`}
                        style={{ display: 'flex', gap: 8, marginTop: 8 }}
                    >
                        <input type="checkbox" id={`cards-save-${methodCode}`} />
                        Save for later use.
                    </label>
                )}
        </div>
    );
}
