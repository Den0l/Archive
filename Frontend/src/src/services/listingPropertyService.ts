import { deleteData, getData, postData, putData } from './httpClient';
import {
    CreateListingPropertyRequest,
    ListingProperty,
    ListingPropertyDetail,
    UpdateListingPropertyRequest,
} from '@/types/api/listingProperties';

import { CreatePropertyValueInsidePropertyRequest } from '@/types/api/listingPropertyValues';

export const fetchListingProperties = async (): Promise<
    ListingPropertyDetail[]
> => {
    return getData<ListingPropertyDetail[]>('/api/ListingProperties');
};

export const fetchListingPropertyById = async (
    id: string
): Promise<ListingPropertyDetail> => {
    return getData<ListingPropertyDetail>(
        `/api/ListingProperties/${id}`
    );
};

export const createListingProperty = async (
    payload: CreateListingPropertyRequest
): Promise<ListingProperty> => {
    return postData<ListingProperty, CreateListingPropertyRequest>(
        '/api/ListingProperties',
        payload
    );
};

export const updateListingProperty = async (
    id: string,
    payload: UpdateListingPropertyRequest
): Promise<ListingProperty> => {
    return putData<ListingProperty, UpdateListingPropertyRequest>(
        `/api/ListingProperties/${id}`,
        payload
    );
};

export const deleteListingProperty = async (
    id: string
): Promise<ListingProperty> => {
    return deleteData<ListingProperty>(
        `/api/ListingProperties/${id}`
    );
};

export const addPropertyValuesToProperty = async (
    id: string,
    propertyValues: CreatePropertyValueInsidePropertyRequest[]
): Promise<ListingPropertyDetail> => {
    return postData<ListingPropertyDetail, CreatePropertyValueInsidePropertyRequest[]>(
        `/api/ListingProperties/AddPropertyValues/${id}`,
        propertyValues
    );
};
