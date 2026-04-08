import api from './apiClient';
import { CheckoutRequest } from '@/types/api/checkout';

export const confirmCheckout = async (
    payload: CheckoutRequest
): Promise<void> => {
    await api.post('/api/Checkout/confirm', payload);
};
