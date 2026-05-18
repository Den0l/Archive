import { postData } from './httpClient';
import { CheckoutRequest, CheckoutResponse } from '@/types/api/checkout';

export const confirmCheckout = async (
    payload: CheckoutRequest
): Promise<CheckoutResponse> => {
    return postData<CheckoutResponse, CheckoutRequest>(
        '/api/Checkout/confirm',
        payload
    );
};
