// hooks/useHidePlaceOrderForWalletMethods.js
import { useEffect, useCallback } from 'react';

const WALLET_METHODS = ['unzer_googlepay', 'unzer_applepayv2'];

export default function useHidePlaceOrderForWalletMethods(
    isSelected,
    methodCode
) {
    const isWalletMethod = WALLET_METHODS.includes(methodCode);

    const addHideButtonCSS = useCallback(() => {
        if (!isWalletMethod) return;

        const styleId = 'unzer-hide-wallet-place-order';
        let styleEl = document.getElementById(styleId);

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.innerHTML = `
        /* Sakrij Place Order dugme za Google/Apple Pay */
        .payment-method-unzer_googlepay ~ * button:contains("Place Order"),
        .payment-method-unzer_applepayv2 ~ * button:contains("Place Order"),
        body:has(.payment-method-unzer_googlepay input:checked) button:contains("Place Order"),
        body:has(.payment-method-unzer_applepayv2 input:checked) button:contains("Place Order") {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      `;
            document.head.appendChild(styleEl);
        }
    }, [isWalletMethod]);

    const removeHideButtonCSS = useCallback(() => {
        const styleEl = document.getElementById('unzer-hide-wallet-place-order');
        if (styleEl) {
            styleEl.remove();
        }
    }, []);

    const hidePlaceOrderButton = useCallback(() => {
        if (!isWalletMethod) return;

        const allButtons = document.querySelectorAll('button');

        allButtons.forEach((button) => {
            const buttonText = (button.textContent || '').toLowerCase().trim();
            const buttonClasses = button.className || '';

            const isPlaceOrderButton =
                buttonText.includes('place order') ||
                buttonClasses.includes('checkout') ||
                button.getAttribute('data-role') === 'place-order' ||
                (button.type === 'button' && buttonText.includes('place'));

            if (
                isPlaceOrderButton &&
                !button.hasAttribute('data-hidden-by-unzer-wallet')
            ) {
                Object.assign(button.style, {
                    display: 'none',
                    visibility: 'hidden',
                    opacity: '0',
                    height: '0',
                    padding: '0',
                    margin: '0',
                });

                button.style.setProperty('display', 'none', 'important');
                button.style.setProperty('visibility', 'hidden', 'important');
                button.style.setProperty('opacity', '0', 'important');
                button.style.setProperty('height', '0', 'important');
                button.style.setProperty('padding', '0', 'important');
                button.style.setProperty('margin', '0', 'important');

                button.setAttribute('data-hidden-by-unzer-wallet', 'true');
            }
        });
    }, [isWalletMethod]);

    const showPlaceOrderButton = useCallback(() => {
        const hiddenButtons = document.querySelectorAll(
            '[data-hidden-by-unzer-wallet="true"]'
        );

        hiddenButtons.forEach((button) => {
            Object.assign(button.style, {
                display: '',
                visibility: '',
                opacity: '',
                height: '',
                padding: '',
                margin: '',
            });

            button.style.removeProperty('display');
            button.style.removeProperty('visibility');
            button.style.removeProperty('opacity');
            button.style.removeProperty('height');
            button.style.removeProperty('padding');
            button.style.removeProperty('margin');

            button.removeAttribute('data-hidden-by-unzer-wallet');
        });
    }, []);

    useEffect(() => {
        if (!isWalletMethod) return undefined;

        if (!isSelected) {
            showPlaceOrderButton();
            removeHideButtonCSS();
            return undefined;
        }

        hidePlaceOrderButton();
        addHideButtonCSS();

        const intervalId = setInterval(hidePlaceOrderButton, 500);

        const observer = new MutationObserver(() => {
            hidePlaceOrderButton();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => {
            clearInterval(intervalId);
            observer.disconnect();
            showPlaceOrderButton();
            removeHideButtonCSS();
        };
    }, [
        isSelected,
        isWalletMethod,
        hidePlaceOrderButton,
        showPlaceOrderButton,
        addHideButtonCSS,
        removeHideButtonCSS,
    ]);

    return { hidePlaceOrderButton, showPlaceOrderButton };
}
