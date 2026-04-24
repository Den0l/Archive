import { getData, postVoid } from './httpClient';
import { Order } from '@/types/api/orders';

export const fetchMyOrdersAsBuyer = async (): Promise<Order[]> => {
    return getData<Order[]>('/api/Orders/my/as-buyer');
};

export const fetchMyOrdersAsSeller = async (): Promise<Order[]> => {
    return getData<Order[]>('/api/Orders/my/as-seller');
};

export const completeOrder = async (orderId: string): Promise<void> => {
    await postVoid(`/api/Orders/${orderId}/complete`);
};

export const fetchOrderByConversation = async (
    conversationId: string
): Promise<Order> => {
    return getData<Order>(
        `/api/Orders/by-conversation/${conversationId}`
    );
};

export const fetchOrdersByConversation = async (
    conversationId: string
): Promise<Order[]> => {
    return getData<Order[]>(
        `/api/Orders/by-conversation/${conversationId}/all`
    );
};

export const fetchPendingOrderByListing = async (
    listingId: string
): Promise<Order> => {
    return getData<Order>(
        `/api/Orders/by-listing/${listingId}/pending`
    );
};

export const cancelOrder = async (orderId: string): Promise<void> => {
    await postVoid(`/api/Orders/${orderId}/cancel`);
};

export const archiveListingForOrder = async (orderId: string): Promise<void> => {
    await postVoid(`/api/Orders/${orderId}/archive`);
};

export const unarchiveListingForOrder = async (
    orderId: string
): Promise<void> => {
    await postVoid(`/api/Orders/${orderId}/unarchive`);
};
