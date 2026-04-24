import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { emitGlobalNotification } from '@/context/notificationBus';

const baseURL =
    process.env.NEXT_PUBLIC_API_BASE_URL || 'https://localhost:7192';

const api = axios.create({
    baseURL,
});

api.interceptors.request.use((config) => {
    const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

type RequestConfigWithGlobalNotification = InternalAxiosRequestConfig & {
    skipGlobalErrorNotification?: boolean;
};

const getGlobalHttpErrorMessage = (status: number) => {
    if (status === 400) {
        return 'Некорректный запрос. Проверьте введённые данные.';
    }
    if (status === 401) {
        return 'Сессия истекла. Пожалуйста, авторизуйтесь заново.';
    }
    if (status === 403) {
        return 'Нет доступа. У вас недостаточно прав для этого действия.';
    }
    if (status === 404) {
        return 'Запрошенный ресурс не найден.';
    }
    if (status === 409) {
        return 'Конфликт данных. Попробуйте обновить страницу.';
    }
    if (status === 429) {
        return 'Слишком много запросов. Подождите немного и попробуйте снова.';
    }
    if (status >= 500) {
        return 'Ошибка сервера. Попробуйте позже.';
    }

    return null;
};

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string }>) => {
        const requestConfig =
            error.config as RequestConfigWithGlobalNotification | undefined;

        if (requestConfig?.skipGlobalErrorNotification) {
            return Promise.reject(error);
        }

        if (error.code === 'ERR_CANCELED') {
            return Promise.reject(error);
        }

        if (!error.response) {
            const networkMessage =
                error.code === 'ECONNABORTED'
                    ? 'Превышено время ожидания ответа от сервера.'
                    : 'Сервер недоступен. Проверьте подключение и попробуйте снова.';

            emitGlobalNotification({
                message: networkMessage,
                level: 'error',
                importance: 'high',
            });

            return Promise.reject(error);
        }

        const { status } = error.response;
        const shouldNotify =
            status === 401 || status === 403 || status === 404 || status >= 500;

        if (shouldNotify) {
            emitGlobalNotification({
                message:
                    getGlobalHttpErrorMessage(status) ??
                    'Произошла непредвиденная ошибка.',
                level: 'error',
                importance: 'high',
            });
        }

        return Promise.reject(error);
    }
);

export default api;
