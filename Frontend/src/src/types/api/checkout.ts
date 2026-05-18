export interface CheckoutItem {
    listingId: string;
    title: string;
    price: number;
    quantity: number;
}

export interface CheckoutRequest {
    items: CheckoutItem[];
    totalItems: number;
    totalPrice: number;
}

export interface CheckoutResponse {
    message: string;
    receiptEmailSent: boolean;
}
