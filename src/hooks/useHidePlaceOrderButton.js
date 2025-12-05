import { useEffect } from 'react';

const WALLET_METHODS = ['unzer_googlepay', 'unzer_applepayv2'];

export default function useHidePlaceOrderForWalletMethods(
    isSelected,
    methodCode
) {
    const isWalletMethod = WALLET_METHODS.includes(methodCode);

    useEffect(() => {
        if (!isWalletMethod) return () => {};

        const styleId = 'unzer-hide-place-order-style';
        let styleEl = document.getElementById(styleId);

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;

            styleEl.textContent = `
        body.unzer-hide-place-order .flex.items-center.justify-center.py-4 button {
          display: none !important;
        }
      `;

            document.head.appendChild(styleEl);
        }

        if (isSelected) {
            document.body.classList.add('unzer-hide-place-order');
        } else {
            document.body.classList.remove('unzer-hide-place-order');
        }

        return () => {
            document.body.classList.remove('unzer-hide-place-order');
        };
    }, [isSelected, isWalletMethod]);
}
