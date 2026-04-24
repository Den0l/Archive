type ReadJsonOptions = {
    removeOnError?: boolean;
    onError?: (error: unknown) => void;
};

export const readJsonFromStorage = <T>(
    key: string,
    fallbackValue: T,
    isValid: (value: unknown) => value is T,
    options?: ReadJsonOptions
): T => {
    try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
            return fallbackValue;
        }

        const parsedValue = JSON.parse(rawValue) as unknown;
        return isValid(parsedValue) ? parsedValue : fallbackValue;
    } catch (error) {
        options?.onError?.(error);
        if (options?.removeOnError) {
            localStorage.removeItem(key);
        }
        return fallbackValue;
    }
};

export const writeJsonToStorage = (key: string, value: unknown) => {
    localStorage.setItem(key, JSON.stringify(value));
};

export const removeFromStorage = (key: string) => {
    localStorage.removeItem(key);
};
