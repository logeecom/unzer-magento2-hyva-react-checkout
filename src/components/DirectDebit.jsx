/* eslint-disable */
import React from 'react';
import BaseUnzerRedirect from './BaseUnzerRedirect';
import useAppContext from '../../../../hook/useAppContext';
import usePaymentMethodCartContext from '../../../../components/paymentMethod/hooks/usePaymentMethodCartContext';

export default function UnzerSepaDirectDebit(props) {
  const methodCode = props.method?.code || 'unzer_direct_debit';
  const { isLoggedIn } = useAppContext();
  const { methodList } = usePaymentMethodCartContext();

  const isEnabled = !!methodList['unzer_direct_debit_vault'];

  const buildAdditionalData = (submitResult) => {
    const shouldSave = document.getElementById(`sepa-save-${methodCode}`)
        ?.checked
        ? '1'
        : '0';

    return {
      resource_id: submitResult.resourceId,
      is_active_payment_token_enabler: shouldSave,
    };
  };

  return (
      <div>
        <BaseUnzerRedirect
            {...props}
            paymentTag="unzer-sepa-direct-debit"
            buildAdditionalData={buildAdditionalData}
        />

        {/* Save for later checkbox */}
        {isLoggedIn &&
            isEnabled &&
            props.selected?.code === props.method?.code && (
                <label
                    htmlFor={`sepa-save-${methodCode}`}
                    style={{ display: 'flex', gap: 8, marginTop: 8 }}
                >
                  <input type="checkbox" id={`sepa-save-${methodCode}`} />
                  Save for later use.
                </label>
            )}
      </div>
  );
}
