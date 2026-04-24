export const requireContext = <T>(
    value: T | undefined,
    hookName: string,
    providerName: string
): T => {
    if (!value) {
        throw new Error(`${hookName} must be used within ${providerName}`);
    }

    return value;
};
