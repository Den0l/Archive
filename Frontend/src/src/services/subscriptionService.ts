import { deleteVoid, getData, postData } from './httpClient';
import {
    SellerSubscription,
    SellerSubscriptionStatus,
} from '@/types/api/users';

export const fetchSubscriptions = async (): Promise<SellerSubscription[]> => {
    return getData<SellerSubscription[]>('/api/SellerSubscriptions');
};

export const fetchSubscriptionStatus = async (
    sellerId: string
): Promise<SellerSubscriptionStatus> => {
    return getData<SellerSubscriptionStatus>(
        `/api/SellerSubscriptions/${sellerId}/status`
    );
};

export const subscribeToSeller = async (
    sellerId: string
): Promise<SellerSubscription> => {
    return postData<SellerSubscription>(
        `/api/SellerSubscriptions/${sellerId}`
    );
};

export const unsubscribeFromSeller = async (
    sellerId: string
): Promise<void> => {
    await deleteVoid(`/api/SellerSubscriptions/${sellerId}`);
};
