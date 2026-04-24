import {
    deleteData,
    getData,
    patchData,
    postData,
    putData,
} from './httpClient';
import {
    AiAutofillListingRequest,
    AiAutofillListingResponse,
    CreateListingRequest,
    Listing,
    ListingDetail,
    ListingStats,
    UpdateListingArchiveRequest,
    UpdateListingRequest,
} from '@/types/api/listings';
import { Page } from '@/types/api/page';
import { ListingFilter } from '@/types/api/categories';

export const fetchListings = async (
    filter: ListingFilter,
    pageNumber = 1,
    pageSize = 12
): Promise<Page<Listing>> => {
    return postData<Page<Listing>, ListingFilter>(
        `/api/Listings/GetAll`,
        filter,
        { params: { pageNumber, pageSize } }
    );
};

export const fetchAllListings = async (
    filter: ListingFilter,
    pageSize = 100
): Promise<Listing[]> => {
    let pageNumber = 1;
    let items: Listing[] = [];

    while (true) {
        const page = await fetchListings(filter, pageNumber, pageSize);
        items = items.concat(page.items);

        if (page.totalPages === 0 || pageNumber >= page.totalPages) {
            break;
        }
        pageNumber += 1;
    }

    return items;
};

export const fetchListingById = async (id: string): Promise<ListingDetail> => {
    return getData<ListingDetail>(`/api/Listings/${id}`);
};

export const fetchListingsByUser = async (): Promise<Listing[]> => {
    return getData<Listing[]>('/api/Listings/GetByUser');
};

export const createListing = async (
    payload: CreateListingRequest
): Promise<Listing> => {
    return postData<Listing, CreateListingRequest>('/api/Listings', payload);
};

export const updateListing = async (
    id: string,
    payload: UpdateListingRequest
): Promise<Listing> => {
    return putData<Listing, UpdateListingRequest>(
        `/api/Listings/${id}`,
        payload
    );
};

export const updateListingArchive = async (
    id: string,
    payload: UpdateListingArchiveRequest
): Promise<Listing> => {
    return patchData<Listing, UpdateListingArchiveRequest>(
        `/api/Listings/${id}/archive`,
        payload
    );
};

export const aiAutofillListing = async (
    payload: AiAutofillListingRequest
): Promise<AiAutofillListingResponse> => {
    const formData = new FormData();

    if (payload.listingId) {
        formData.append('listingId', payload.listingId);
    }

    if (payload.descriptionHint) {
        formData.append('descriptionHint', payload.descriptionHint);
    }

    payload.existingImageIds?.forEach((imageId) => {
        formData.append('existingImageIds', imageId);
    });

    payload.newImages?.forEach((file) => {
        formData.append('newImages', file);
    });

    return postData<AiAutofillListingResponse, FormData>(
        '/api/Listings/AiAutofill',
        formData,
        {
            headers: { 'Content-Type': 'multipart/form-data' },
        }
    );
};

export const fetchListingStats = async (
    id: string
): Promise<ListingStats> => {
    return getData<ListingStats>(`/api/Listings/${id}/stats`);
};

export const fetchListingStatsBatch = async (
    listingIds: string[]
): Promise<Record<string, ListingStats>> => {
    return postData<Record<string, ListingStats>, string[]>(
        '/api/Listings/StatsBatch',
        listingIds
    );
};

export const deleteListing = async (id: string): Promise<Listing> => {
    return deleteData<Listing>(`/api/Listings/${id}`);
};
