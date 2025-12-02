/* eslint-disable */
import { useEffect, useRef, useState } from 'react';

const DEFAULT_URL = 'https://static-v2.unzer.com/v2/ui-components/index.js';

// The <script type="module"> is loaded only once globally, regardless of component count
let globalScriptPromise = null;

/**
 * Load Unzer UI (once) and wait for required custom elements to be defined.
 *
 * @param {Object} options
 * @param {string[]} [options.components=['unzer-card']]  // method-specific tags
 * @param {boolean} [options.waitForCheckout=true]        // also wait for 'unzer-checkout'
 * @param {string} [options.url=DEFAULT_URL]              // script URL
 * @returns {boolean} ready
 */
export default function useUnzerSdk({
                                        components = [
                                            ['unzer-card'],
                                            ['unzer-direct-debit'],
                                            ['unzer-open-banking'],
                                            ['unzer-paylater-invoice'],
                                            ['unzer-paypal'],
                                            ['unzer-alipay'],
                                            ['unzer-wechatpay'],
                                            ['unzer-prepayment'],
                                            ['unzer-klarna'],
                                            ['unzer-wero'],
                                            ['unzer-eps'],
                                            ['unzer-twint'],
                                            ['unzer-google-pay'],
                                            ['unzer-apple-pay'],
                                            ['unzer-bancontact'],
                                        ],
                                        waitForCheckout = true,
                                        url = DEFAULT_URL,
                                    } = {}) {
    const [ready, setReady] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        // Helper: wait for a list of custom elements to be defined
        const waitForTags = async (tags) => {
            const missing = tags.filter((t) => !window.customElements?.get?.(t));
            if (missing.length === 0) return true;
            await Promise.all(missing.map((t) => customElements.whenDefined(t)));
            return true;
        };

        async function ensureSdk() {
            const base = ['unzer-payment'];
            const extra = [
                ...components,
                ...(waitForCheckout ? ['unzer-checkout'] : []),
            ];
            const allTags = [...new Set([...base, ...extra])];

            const allDefined = allTags.every(
                (t) => !!window.customElements?.get?.(t)
            );
            if (allDefined) {
                if (mounted.current) setReady(true);
                return;
            }

            // Load the <script type="module"> once globally
            if (!globalScriptPromise) {
                globalScriptPromise = new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.type = 'module';
                    s.src = url;
                    s.async = true;
                    s.onload = resolve;
                    s.onerror = () => reject(new Error('Failed to load Unzer UI'));
                    document.head.appendChild(s);
                });
            }

            try {
                await globalScriptPromise;
                await waitForTags(['unzer-payment']);
                await waitForTags(components);
                if (waitForCheckout) await waitForTags(['unzer-checkout']);

                if (mounted.current) setReady(true);
            } catch (e) {
                console.error('[Unzer] UI load failed', e);
                if (mounted.current) setReady(false);
            }
        }

        ensureSdk();
        return () => {
            mounted.current = false;
        };
    }, [components.join(','), waitForCheckout, url]);

    return ready;
}
