import api from './apiClient';
import { Order } from '@/types/api/orders';

export const fetchOrderByConversation = async (
    conversationId: string
): Promise<Order> => {
    const { data } = await api.get<Order>(
        `/api/Orders/by-conversation/${conversationId}`
    );
    return data;
};

export const fetchOrdersByConversation = async (
    conversationId: string
): Promise<Order[]> => {
    const { data } = await api.get<Order[]>(
        `/api/Orders/by-conversation/${conversationId}/all`
    );
    return data;
};

export const fetchPendingOrderByListing = async (
    listingId: string
): Promise<Order> => {
    const { data } = await api.get<Order>(
        `/api/Orders/by-listing/${listingId}/pending`
    );
    return data;
};

export const cancelOrder = async (orderId: string): Promise<void> => {
    await api.post(`/api/Orders/${orderId}/cancel`);
};

export const archiveListingForOrder = async (orderId: string): Promise<void> => {
    await api.post(`/api/Orders/${orderId}/archive`);
};

export const unarchiveListingForOrder = async (
    orderId: string
): Promise<void> => {
    await api.post(`/api/Orders/${orderId}/unarchive`);
};
