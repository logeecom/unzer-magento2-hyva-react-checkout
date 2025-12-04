import { useCallback } from 'react';
import { get as _get, set as _set } from 'lodash-es';
import { __ } from '../../../../i18n';
import { LOGIN_FORM } from '../../../../config';
import useAppContext from '../../../../hook/useAppContext';
import useCartContext from '../../../../hook/useCartContext';
import { _isObjEmpty, _keys } from '../../../../utils';
import LocalStorage from '../../../../utils/localStorage';

// UNZER-SPECIFIC performRedirect
const performUnzerRedirect = (order) => {
  if (order) {
    LocalStorage.clearCheckoutStorage();
    window.location.replace(`${window.BASE_URL || '/'}unzer/payment/redirect`);
  }
};

export default function useUnzerPerformPlaceOrder(paymentMethodCode) {
  const { cartId, setRestPaymentMethod, setOrderInfo } = useCartContext();
  const { isLoggedIn, setPageLoader, setErrorMessage, checkoutAgreements } =
    useAppContext();

  return useCallback(
    async (
      values,
      { extraPaymentData = {}, additionalData, extensionAttributes = {} }
    ) => {
      try {
        const email = _get(values, `${LOGIN_FORM}.email`);
        const paymentMethodData = {
          paymentMethod: {
            method: paymentMethodCode,
            ...extraPaymentData,
            additional_data: additionalData,
          },
        };

        if (
          !_isObjEmpty(extensionAttributes) ||
          !_isObjEmpty(checkoutAgreements)
        ) {
          _set(paymentMethodData, 'paymentMethod.extension_attributes', {
            ...extensionAttributes,
            agreement_ids: _keys(checkoutAgreements),
          });
        }

        if (!isLoggedIn) {
          _set(paymentMethodData, 'email', email);
        } else {
          _set(paymentMethodData, 'cartId', cartId);
        }

        setPageLoader(true);
        const order = await setRestPaymentMethod(paymentMethodData, isLoggedIn);
        setPageLoader(false);

        performUnzerRedirect(order);

        if (order) {
          setOrderInfo(order);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(
          __(
            'This transaction could not be performed. Please select another payment method.'
          )
        );
        setPageLoader(false);
      }
    },
    [
      cartId,
      isLoggedIn,
      setOrderInfo,
      setPageLoader,
      setErrorMessage,
      paymentMethodCode,
      checkoutAgreements,
      setRestPaymentMethod,
    ]
  );
}
