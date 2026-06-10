import { paymentApi } from '../api/payment.api';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: () => void) => void;
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Load the Razorpay checkout script dynamically
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Full Razorpay payment initiation flow
 */
export const initiateRazorpayPayment = async ({
  orderId,
  userName,
  userEmail,
  userPhone,
  onSuccess,
  onDismiss,
}: {
  orderId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  onSuccess: (verifiedOrderId: string) => void;
  onDismiss?: () => void;
}): Promise<void> => {
  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error('Failed to load Razorpay SDK. Check your internet connection.');

  // Create Razorpay order on backend
  const { data: responseData } = await paymentApi.createOrder(orderId);
  const rzpData = responseData.data!;

  const options: RazorpayOptions = {
    key: rzpData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
    amount: rzpData.amount,
    currency: rzpData.currency || 'INR',
    name: 'DSLR WORLD',
    description: 'Camera Purchase — Ranchi, Jharkhand',
    order_id: rzpData.razorpayOrderId,
    prefill: { name: userName, email: userEmail, contact: userPhone },
    theme: { color: '#E94560' },
    handler: async (response: RazorpayResponse) => {
      const { data: verifyData } = await paymentApi.verifyPayment({
        orderId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      });
      onSuccess(verifyData.data!.orderId);
    },
    modal: { ondismiss: onDismiss },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
};
