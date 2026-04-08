import { Listing } from './listings';

export interface FavoriteItemDto {
    listingId: string;
    listing: Listing;
    createdAt: string;
}
