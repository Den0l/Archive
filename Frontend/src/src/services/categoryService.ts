import {
    deleteData,
    getData,
    postData,
    putData,
} from './httpClient';
import {
    Category,
    CategoryDetail,
    CategoryHierarchy,
    CreateCategoryRequest,
    UpdateCategoryRequest,
    AddListingPropertiesToCategoryRequest,
    RemoveListingPropertyFromCategoryRequest,
} from '@/types/api/categories';
import { ListingFilter } from '@/types/api/categories';
import { Listing } from '@/types/api/listings';
import { Page } from '@/types/api/page';

export const fetchCategories = async (): Promise<Category[]> => {
    return getData<Category[]>('/api/Categories');
};

export const fetchCategoryHierarchy = async (): Promise<
    CategoryHierarchy[]
> => {
    return getData<CategoryHierarchy[]>('/api/Categories/Hierarchy');
};

export const fetchCategoryById = async (
    id: string
): Promise<CategoryDetail> => {
    return getData<CategoryDetail>(`/api/Categories/${id}`);
};

export const fetchCategoryByName = async (
    name: string
): Promise<CategoryDetail> => {
    return getData<CategoryDetail>(
        `/api/Categories/GetByName/${encodeURIComponent(name)}`
    );
};

export const fetchListingsByCategoryName = async (
    name: string,
    filter: ListingFilter,
    pageNumber = 1,
    pageSize = 12
): Promise<Page<Listing>> => {
    return postData<Page<Listing>, ListingFilter>(
        `/api/Categories/${encodeURIComponent(name)}`,
        filter,
        { params: { pageNumber, pageSize } }
    );
};

export const createCategory = async (
    payload: CreateCategoryRequest
): Promise<Category> => {
    return postData<Category, CreateCategoryRequest>('/api/Categories', payload);
};

export const updateCategory = async (
    id: string,
    payload: UpdateCategoryRequest
): Promise<Category> => {
    return putData<Category, UpdateCategoryRequest>(
        `/api/Categories/${id}`,
        payload
    );
};

export const addListingPropertiesToCategory = async (
    id: string,
    payload: AddListingPropertiesToCategoryRequest
): Promise<Category> => {
    return putData<Category, AddListingPropertiesToCategoryRequest>(
        `/api/Categories/AddListingProperties/${id}`,
        payload
    );
};

export const removeListingPropertyFromCategory = async (
    id: string,
    payload: RemoveListingPropertyFromCategoryRequest
): Promise<Category> => {
    return putData<Category, RemoveListingPropertyFromCategoryRequest>(
        `/api/Categories/RemoveListingProperty/${id}`,
        payload
    );
};

export const deleteCategory = async (id: string): Promise<Category> => {
    return deleteData<Category>(`/api/Categories/${id}`);
};
