export enum OrderStatus {
    Pending = 0,
    Cancelled = 1,
    Completed = 2,
}

export interface Order {
    id: string;
    listingId: string;
    listingTitle: string;
    listingPrice: number;
    listingImageUrl: string | null;
    buyerId: string;
    buyerNickname: string;
    sellerId: string;
    sellerNickname: string;
    conversationId: string;
    status: OrderStatus;
    createdAt: string;
    cancelledAt: string | null;
    isListingSold: boolean;
    isListingArchived: boolean;
}
