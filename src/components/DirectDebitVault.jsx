import React from 'react';
import BaseUnzerVault from './BaseUnzerVault';

export default function UnzerSepaDirectDebitVault(props) {
  return (
      <BaseUnzerVault
          {...props}
          tokenPrefix="unzer_direct_debit_vault_"
          buildLabel={(token) => {
            const d = token.details;
            return `${d?.accountHolder || 'Account Holder'} - ${
                d?.maskedIban || '****'
            }`;
          }}
      />
  );
}
