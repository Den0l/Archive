export interface User {
    id: string;
    nickname: string;
    email: string;
    lastLoggedIn: string;
}

export interface UserDetail extends User {
    roles: string[];
}

export interface NotificationPreferences {
    notifyEmailOnNewMessage: boolean;
    notifyEmailOnSellerOrder: boolean;
    notifyEmailOnFollowedSellerListing: boolean;
    notifyEmailOnLogin: boolean;
}

export interface UserSettings {
    email: string;
    pendingEmail: string | null;
    emailConfirmed: boolean;
    notifications: NotificationPreferences;
}

export interface UpdateNotificationPreferencesRequest
    extends NotificationPreferences {}

export interface RequestEmailChangeRequest {
    newEmail: string;
}

export interface ConfirmEmailCodeRequest {
    code: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}

export interface SellerSubscription {
    sellerId: string;
    sellerNickname: string;
    subscribedAt: string;
}

export interface SellerSubscriptionStatus {
    sellerId: string;
    isSubscribed: boolean;
}
