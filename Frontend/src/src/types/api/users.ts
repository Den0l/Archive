export interface User {
    id: string;
    nickname: string;
    email: string;
    lastLoggedIn: string;
}

export interface UserDetail extends User {
    roles: string[];
}
