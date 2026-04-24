import { getData } from './httpClient';
import { StateOfItem } from '@/types/api/stateOfItem';

export const fetchStatesOfItem = async (): Promise<StateOfItem[]> => {
    return getData<StateOfItem[]>('/api/StateOfItem');
};
