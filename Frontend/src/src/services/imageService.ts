import { deleteData, getData, postFormData } from './httpClient';
import { Image, AddImageRequest } from '@/types/api/images';

export const fetchImages = async (): Promise<Image[]> => {
    return getData<Image[]>('/api/Images');
};

export const fetchImageById = async (id: string): Promise<Image> => {
    return getData<Image>(`/api/Images/${id}`);
};

export const uploadImage = async (payload: AddImageRequest): Promise<Image> => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('listingId', payload.listingId);

    return postFormData<Image>('/api/Images/Upload', formData);
};

export const deleteImage = async (id: string): Promise<Image> => {
    return deleteData<Image>(`/api/Images/${id}`);
};
