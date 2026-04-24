import axios from 'axios';
import { postData } from './httpClient';

const REMOVE_BACKGROUND_ENDPOINT = '/api/Images/RemoveBackground';

const buildTransparentFileName = (sourceName: string): string => {
    const normalizedName = sourceName.trim() || 'photo';
    const lastDotIndex = normalizedName.lastIndexOf('.');
    const baseName =
        lastDotIndex > 0
            ? normalizedName.slice(0, lastDotIndex)
            : normalizedName;

    return `${baseName}-no-bg.png`;
};

const parseErrorMessage = async (error: unknown): Promise<string> => {
    if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;

        if (typeof responseData === 'string' && responseData.trim()) {
            return responseData.trim();
        }

        if (responseData instanceof Blob) {
            const text = (await responseData.text()).trim();
            if (text) {
                try {
                    const parsed = JSON.parse(text) as { message?: string };
                    if (
                        typeof parsed.message === 'string' &&
                        parsed.message.trim()
                    ) {
                        return parsed.message.trim();
                    }
                } catch {
                    return text;
                }
            }
        }

        if (
            responseData &&
            typeof responseData === 'object' &&
            'message' in responseData &&
            typeof responseData.message === 'string' &&
            responseData.message.trim()
        ) {
            return responseData.message.trim();
        }

        if (typeof error.message === 'string' && error.message.trim()) {
            return error.message.trim();
        }
    }

    return 'Не удалось убрать фон с изображения.';
};

const requestBackgroundRemoval = async (
    formData: FormData,
    sourceName: string
): Promise<File> => {
    try {
        const blob = await postData<Blob, FormData>(
            REMOVE_BACKGROUND_ENDPOINT,
            formData,
            { responseType: 'blob' }
        );

        return new File([blob], buildTransparentFileName(sourceName), {
            type: 'image/png',
            lastModified: Date.now(),
        });
    } catch (error) {
        throw new Error(await parseErrorMessage(error));
    }
};

export const removeBackgroundFromFile = async (file: File): Promise<File> => {
    const formData = new FormData();
    formData.append('file', file);

    return requestBackgroundRemoval(formData, file.name);
};

export const removeBackgroundFromImageId = async (
    imageId: string,
    sourceName: string
): Promise<File> => {
    const formData = new FormData();
    formData.append('imageId', imageId);

    return requestBackgroundRemoval(formData, sourceName);
};
