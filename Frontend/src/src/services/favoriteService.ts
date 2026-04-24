import { deleteVoid, getData, postData } from './httpClient';
import { FavoriteItemDto } from '@/types/api/favorites';

export const fetchFavorites = async (): Promise<FavoriteItemDto[]> => {
    return getData<FavoriteItemDto[]>('/api/Favorites');
};

export const addFavorite = async (
    listingId: string
): Promise<FavoriteItemDto> => {
    return postData<FavoriteItemDto, { listingId: string }>('/api/Favorites', {
        listingId,
    });
};

export const removeFavorite = async (listingId: string): Promise<void> => {
    await deleteVoid(`/api/Favorites/${listingId}`);
};
