import React from 'react';
import BaseUnzerVault from './BaseUnzerVault';

export default function UnzerPayPalVault(props) {
    return (
        <BaseUnzerVault
            {...props}
            tokenPrefix="unzer_paypal_vault_"
            buildLabel={(token) => {
                const email = token.details?.payerEmail || 'PayPal Account';
                return `${email}`;
            }}
        />
    );
}
