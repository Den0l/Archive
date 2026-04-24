import type { AxiosRequestConfig } from 'axios';
import api from './apiClient';

export const getData = async <T>(
    url: string,
    config?: AxiosRequestConfig
): Promise<T> => {
    const { data } = await api.get<T>(url, config);
    return data;
};

export const postData = async <T, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig
): Promise<T> => {
    const { data } = await api.post<T>(url, body, config);
    return data;
};

export const putData = async <T, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig
): Promise<T> => {
    const { data } = await api.put<T>(url, body, config);
    return data;
};

export const patchData = async <T, TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig
): Promise<T> => {
    const { data } = await api.patch<T>(url, body, config);
    return data;
};

export const deleteData = async <T>(
    url: string,
    config?: AxiosRequestConfig
): Promise<T> => {
    const { data } = await api.delete<T>(url, config);
    return data;
};

export const postVoid = async <TBody = unknown>(
    url: string,
    body?: TBody,
    config?: AxiosRequestConfig
): Promise<void> => {
    await api.post(url, body, config);
};

export const deleteVoid = async (
    url: string,
    config?: AxiosRequestConfig
): Promise<void> => {
    await api.delete(url, config);
};
