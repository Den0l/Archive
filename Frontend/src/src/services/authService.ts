import { postData } from './httpClient';
import {
    ConfirmEmailChangeRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
} from '@/types/api/auth';

export const registerUser = async (data: RegisterRequest): Promise<string> => {
    return postData<string, RegisterRequest>('/api/Auth/Register', data);
};

export const loginUser = async (data: LoginRequest): Promise<LoginResponse> => {
    return postData<LoginResponse, LoginRequest>('/api/Auth/Login', data);
};

export const forgotPassword = async (
    data: ForgotPasswordRequest
): Promise<string> => {
    return postData<string, ForgotPasswordRequest>(
        '/api/Auth/ForgotPassword',
        data
    );
};

export const confirmEmailChange = async (
    data: ConfirmEmailChangeRequest
): Promise<string> => {
    return postData<string, ConfirmEmailChangeRequest>(
        '/api/Auth/confirm-email-change',
        data
    );
};
