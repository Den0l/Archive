import api from './apiClient';
import { FavoriteItemDto } from '@/types/api/favorites';

export const fetchFavorites = async (): Promise<FavoriteItemDto[]> => {
    const { data } = await api.get<FavoriteItemDto[]>('/api/Favorites');
    return data;
};

export const addFavorite = async (
    listingId: string
): Promise<FavoriteItemDto> => {
    const { data } = await api.post<FavoriteItemDto>('/api/Favorites', {
        listingId,
    });
    return data;
};

export const removeFavorite = async (listingId: string): Promise<void> => {
    await api.delete(`/api/Favorites/${listingId}`);
};
