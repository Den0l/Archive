export enum OrderStatus {
    Pending = 0,
    Cancelled = 1,
    Completed = 2,
}

export interface Order {
    id: string;
    listingId: string;
    listingTitle: string;
    buyerId: string;
    buyerNickname: string;
    sellerId: string;
    conversationId: string;
    status: OrderStatus;
    createdAt: string;
    isListingSold: boolean;
    isListingArchived: boolean;
}
