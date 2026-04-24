import { deleteData, getData, postData, putData } from './httpClient';
import {
    CreateListingPropertyValueRequest,
    ListingPropertyValue,
    UpdateListingPropertyValueRequest,
} from '@/types/api/listingPropertyValues';

export const fetchListingPropertyValues = async (): Promise<
    ListingPropertyValue[]
> => {
    return getData<ListingPropertyValue[]>('/api/ListingPropertyValues');
};

export const fetchListingPropertyValueById = async (
    id: string
): Promise<ListingPropertyValue> => {
    return getData<ListingPropertyValue>(
        `/api/ListingPropertyValues/${id}`
    );
};

export const createListingPropertyValue = async (
    payload: CreateListingPropertyValueRequest
): Promise<ListingPropertyValue> => {
    return postData<ListingPropertyValue, CreateListingPropertyValueRequest>(
        '/api/ListingPropertyValues',
        payload
    );
};

export const updateListingPropertyValue = async (
    id: string,
    payload: UpdateListingPropertyValueRequest
): Promise<ListingPropertyValue> => {
    return putData<ListingPropertyValue, UpdateListingPropertyValueRequest>(
        `/api/ListingPropertyValues/${id}`,
        payload
    );
};

export const deleteListingPropertyValue = async (
    id: string
): Promise<ListingPropertyValue> => {
    return deleteData<ListingPropertyValue>(
        `/api/ListingPropertyValues/${id}`
    );
};
