import React from 'react';
import BaseUnzerVault from './BaseUnzerVault';

export default function UnzerCardsVault(props) {
  return (
      <BaseUnzerVault
          {...props}
          tokenPrefix="unzer_cards_vault_"
          buildLabel={(token) => {
            const d = token.details;
            const masked = d?.maskedCC || '**** **** **** ****';
            const last4 = masked.slice(-4);
            return `${d.cardBrand || 'Card'} **** ${last4} (expires ${
                d.formattedExpirationDate || 'MM/YY'
            })`;
          }}
      />
  );
}
