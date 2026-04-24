import { getData } from './httpClient';
import { City } from '@/types/api/cities';

export const fetchCities = async (filter?: string): Promise<City[]> => {
    return getData<City[]>('/api/Cities', {
        params: filter !== undefined ? { filter } : undefined,
    });
};
