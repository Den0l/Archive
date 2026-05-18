const DEFAULT_API_BASE_URL = 'https://localhost:7192';
const EMULATOR_HOST = '10.0.2.2';

const normalizeApiBaseUrl = (): string => {
    const configured =
        process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

    try {
        return new URL(configured).origin;
    } catch {
        return DEFAULT_API_BASE_URL;
    }
};

const isLikelyLocalBackendHost = (hostName: string): boolean => {
    const normalizedHost = hostName.toLowerCase();
    return (
        normalizedHost === 'localhost' ||
        normalizedHost === '127.0.0.1' ||
        normalizedHost === EMULATOR_HOST
    );
};

export const resolveApiAssetUrl = (rawUrl?: string | null): string => {
    if (!rawUrl) {
        return '';
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) {
        return '';
    }

    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
        return trimmed;
    }

    const apiOrigin = normalizeApiBaseUrl();

    if (trimmed.startsWith('/')) {
        return `${apiOrigin}${trimmed}`;
    }

    try {
        const parsed = new URL(trimmed);
        if (!isLikelyLocalBackendHost(parsed.hostname)) {
            return trimmed;
        }

        return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return `${apiOrigin}/${trimmed.replace(/^\/+/, '')}`;
    }
};
