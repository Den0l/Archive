import { postVoid } from './httpClient';
import { CheckoutRequest } from '@/types/api/checkout';

export const confirmCheckout = async (
    payload: CheckoutRequest
): Promise<void> => {
    await postVoid<CheckoutRequest>('/api/Checkout/confirm', payload);
};
