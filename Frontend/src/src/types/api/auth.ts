export interface ApplicationUser {}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    jwtToken: string;
    mustChangePassword: boolean;
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface RegisterRequest {
    username: string;
    nickname: string;
    password: string;
}

export interface ConfirmEmailChangeRequest {
    userId: string;
    newEmail: string;
    token: string;
}
