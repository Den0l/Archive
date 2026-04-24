import { getData, postData, postVoid, putData } from './httpClient';
import {
    ChangePasswordRequest,
    ConfirmEmailCodeRequest,
    RequestEmailChangeRequest,
    UpdateNotificationPreferencesRequest,
    UserSettings,
} from '@/types/api/users';

export const fetchUserSettings = async (): Promise<UserSettings> => {
    return getData<UserSettings>('/api/Users/me/settings');
};

export const updateNotificationPreferences = async (
    request: UpdateNotificationPreferencesRequest
): Promise<UserSettings> => {
    return putData<UserSettings, UpdateNotificationPreferencesRequest>(
        '/api/Users/me/settings/notifications',
        request
    );
};

export const requestEmailChange = async (
    request: RequestEmailChangeRequest
): Promise<UserSettings> => {
    return postData<UserSettings, RequestEmailChangeRequest>(
        '/api/Users/me/settings/email/change-request',
        request
    );
};

export const requestCurrentEmailVerificationCode = async (): Promise<void> => {
    await postVoid('/api/Users/me/settings/email/verify-request');
};

export const confirmCurrentEmailByCode = async (
    request: ConfirmEmailCodeRequest
): Promise<UserSettings> => {
    return postData<UserSettings, ConfirmEmailCodeRequest>(
        '/api/Users/me/settings/email/verify-confirm',
        request
    );
};

export const confirmEmailChangeByCode = async (
    request: ConfirmEmailCodeRequest
): Promise<UserSettings> => {
    return postData<UserSettings, ConfirmEmailCodeRequest>(
        '/api/Users/me/settings/email/change-confirm',
        request
    );
};

export const changePassword = async (
    request: ChangePasswordRequest
): Promise<string> => {
    return postData<string, ChangePasswordRequest>(
        '/api/Users/me/settings/password',
        request
    );
};
