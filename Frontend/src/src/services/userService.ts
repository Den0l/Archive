import {
    deleteData,
    deleteVoid,
    getData,
    postData,
} from './httpClient';
import { User, UserDetail } from '@/types/api/users';

export const fetchUserById = async (id: string): Promise<User> => {
    return getData<User>(`/api/Users/${id}`);
};

export const fetchUserDetail = async (id: string): Promise<UserDetail> => {
    return getData<UserDetail>(`/api/Users/${id}/detail`);
};

export const fetchAllUserDetails = async (): Promise<UserDetail[]> => {
    return getData<UserDetail[]>(`/api/Users/GetAll`);
};

export const deleteUser = async (id: string): Promise<void> => {
    await deleteVoid(`/api/Users/${id}`);
};

export const addAdminRole = async (id: string): Promise<UserDetail> => {
    return postData<UserDetail>(`/api/Users/${id}/roles/admin`);
};

export const removeAdminRole = async (id: string): Promise<UserDetail> => {
    return deleteData<UserDetail>(
        `/api/Users/${id}/roles/admin`
    );
};
