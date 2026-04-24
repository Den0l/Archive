import { Image } from './images';
import { City } from './cities';
import { Category } from './categories';
import { ListingPropertyValueDetail } from './listingPropertyValues';
import { StateOfItem } from './stateOfItem';

export interface CreateListingRequest {
    price: number;
    stateOfItemId: string;
    title: string;
    description: string;
    categoryId: string;
    cityId: string;
    propertyValueSelection: ListingPropertyValueSelection[];
}

export interface Listing {
    id: string;
    price: number;
    sellerId: string;
    title: string;
    description: string;
    isSold: boolean;
    isArchived: boolean;
    createdAt: string;
    images: Image[];
}

export interface ListingDetail {
    id: string;
    price: number;
    sellerId: string;
    stateOfItem: StateOfItem;
    title: string;
    description: string;
    isSold: boolean;
    isArchived: boolean;
    category: Category;
    city: City;
    selectedListingPropertyValues: ListingPropertyValueDetail[];
    images: Image[];
}

export interface ListingPropertyValueSelection {
    listingPropertyId: string;
    selectedListingPropertyValueId: string;
}

export interface AiAutofillListingRequest {
    listingId?: string;
    descriptionHint?: string;
    existingImageIds?: string[];
    newImages?: File[];
}

export interface AiAutofillListingResponse {
    title: string;
    description: string;
    stateOfItemId: string;
    categoryId: string;
    propertyValueSelection: ListingPropertyValueSelection[];
    warnings: string[];
}

export interface ListingStats {
    viewCount: number;
    favoriteCount: number;
    cartCount: number;
}

export interface UpdateListingRequest {
    price: number;
    stateOfItemId: string;
    title: string;
    description: string;
    categoryId: string;
    cityId: string;
    propertyValueSelection: ListingPropertyValueSelection[];
    isSold: boolean;
    isArchived: boolean;
}

export interface UpdateListingArchiveRequest {
    isArchived: boolean;
}
