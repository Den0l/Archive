export const VALIDATION_LIMITS = {
    emailMaxLength: 254,
    nicknameMinLength: 2,
    nicknameMaxLength: 50,
    passwordMinLength: 6,
    passwordMaxLength: 128,
    entityNameMinLength: 2,
    entityNameMaxLength: 80,
    listingTitleMinLength: 5,
    listingTitleMaxLength: 120,
    listingDescriptionMinLength: 20,
    listingDescriptionMaxLength: 2000,
    reviewMinLength: 10,
    reviewMaxLength: 1000,
    messageMaxLength: 1000,
    searchMaxLength: 100,
    cityQueryMaxLength: 100,
    maxImageCount: 20,
    maxImageSizeBytes: 10 * 1024 * 1024,
    priceMin: 1,
    priceMax: 1_000_000,
    radiusMin: 1,
    radiusMax: 1000,
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ALLOWED_IMAGE_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.bmp',
    '.avif',
];
export const ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/x-ms-bmp',
    'image/avif',
];
export const IMAGE_UPLOAD_ACCEPT = [
    ...ALLOWED_IMAGE_EXTENSIONS,
    ...ALLOWED_IMAGE_MIME_TYPES,
].join(',');
const PRICE_DECIMAL_SEPARATOR = ',';
const PRICE_MAX_DECIMAL_DIGITS = 2;

type TextValidationOptions = {
    label: string;
    minLength: number;
    maxLength: number;
    multiline?: boolean;
};

export const normalizeSingleLine = (value: string) =>
    value.replace(/\s+/g, ' ').trim();

export const normalizeMultiline = (value: string) =>
    value
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const validateText = (
    value: string,
    { label, minLength, maxLength, multiline = false }: TextValidationOptions
) => {
    const normalized = multiline
        ? normalizeMultiline(value)
        : normalizeSingleLine(value);

    if (!normalized) {
        return `Поле "${label}" обязательно для заполнения.`;
    }
    if (normalized.length < minLength) {
        return `Поле "${label}" должно содержать минимум ${minLength} символов.`;
    }
    if (normalized.length > maxLength) {
        return `Поле "${label}" должно содержать не больше ${maxLength} символов.`;
    }

    return null;
};

export const validateEmail = (value: string) => {
    const normalized = value.trim();

    if (!normalized) {
        return 'Укажите email.';
    }
    if (normalized.length > VALIDATION_LIMITS.emailMaxLength) {
        return `Email должен содержать не больше ${VALIDATION_LIMITS.emailMaxLength} символов.`;
    }
    if (!EMAIL_REGEX.test(normalized)) {
        return 'Введите корректный email.';
    }

    return null;
};

export const validatePassword = (value: string) => {
    if (!value) {
        return 'Укажите пароль.';
    }
    if (value.length < VALIDATION_LIMITS.passwordMinLength) {
        return `Пароль должен содержать минимум ${VALIDATION_LIMITS.passwordMinLength} символов.`;
    }
    if (value.length > VALIDATION_LIMITS.passwordMaxLength) {
        return `Пароль должен содержать не больше ${VALIDATION_LIMITS.passwordMaxLength} символов.`;
    }

    return null;
};

export const validateNickname = (value: string) =>
    validateText(value, {
        label: 'Никнейм',
        minLength: VALIDATION_LIMITS.nicknameMinLength,
        maxLength: VALIDATION_LIMITS.nicknameMaxLength,
    });

export const validateEntityName = (label: string, value: string) =>
    validateText(value, {
        label,
        minLength: VALIDATION_LIMITS.entityNameMinLength,
        maxLength: VALIDATION_LIMITS.entityNameMaxLength,
    });

export const validateListingTitle = (value: string) =>
    validateText(value, {
        label: 'Название',
        minLength: VALIDATION_LIMITS.listingTitleMinLength,
        maxLength: VALIDATION_LIMITS.listingTitleMaxLength,
    });

export const validateListingDescription = (value: string) =>
    validateText(value, {
        label: 'Описание',
        minLength: VALIDATION_LIMITS.listingDescriptionMinLength,
        maxLength: VALIDATION_LIMITS.listingDescriptionMaxLength,
        multiline: true,
    });

export const validateReviewText = (value: string) =>
    validateText(value, {
        label: 'Отзыв',
        minLength: VALIDATION_LIMITS.reviewMinLength,
        maxLength: VALIDATION_LIMITS.reviewMaxLength,
        multiline: true,
    });

export const validateMessageText = (value: string) =>
    validateText(value, {
        label: 'Сообщение',
        minLength: 1,
        maxLength: VALIDATION_LIMITS.messageMaxLength,
        multiline: true,
    });

export const validateSearchText = (value: string) => {
    const normalized = normalizeSingleLine(value);

    if (!normalized) {
        return null;
    }
    if (normalized.length > VALIDATION_LIMITS.searchMaxLength) {
        return `Поисковый запрос должен содержать не больше ${VALIDATION_LIMITS.searchMaxLength} символов.`;
    }

    return null;
};

export const validateCityQuery = (value: string) => {
    const normalized = normalizeSingleLine(value);

    if (!normalized) {
        return null;
    }
    if (normalized.length > VALIDATION_LIMITS.cityQueryMaxLength) {
        return `Название города должно содержать не больше ${VALIDATION_LIMITS.cityQueryMaxLength} символов.`;
    }

    return null;
};

export const validatePrice = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
        return 'Укажите цену.';
    }
    if (value < VALIDATION_LIMITS.priceMin) {
        return `Цена должна быть не меньше ${VALIDATION_LIMITS.priceMin}.`;
    }
    if (value > VALIDATION_LIMITS.priceMax) {
        return `Цена должна быть не больше ${VALIDATION_LIMITS.priceMax}.`;
    }

    return null;
};

export const sanitizePriceInput = (value: string) => {
    const normalized = value.replace(/\s+/g, '').replace(/\./g, ',');
    let result = '';
    let hasSeparator = false;
    let decimalDigits = 0;

    for (const char of normalized) {
        if (/\d/.test(char)) {
            if (hasSeparator) {
                if (decimalDigits >= PRICE_MAX_DECIMAL_DIGITS) {
                    continue;
                }
                decimalDigits += 1;
            }

            result += char;
            continue;
        }

        if (char === PRICE_DECIMAL_SEPARATOR && !hasSeparator) {
            result += result.length === 0 ? `0${PRICE_DECIMAL_SEPARATOR}` : char;
            hasSeparator = true;
        }
    }

    return result;
};

export const parsePriceInput = (value: string) => {
    const normalized = sanitizePriceInput(value);

    if (!normalized) {
        return undefined;
    }

    const parsed = Number(normalized.replace(PRICE_DECIMAL_SEPARATOR, '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
};

export const formatPriceInput = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
        return '';
    }

    return value.toString().replace('.', PRICE_DECIMAL_SEPARATOR);
};

export const validateOptionalPrice = (value: number | null) => {
    if (value == null) {
        return null;
    }

    return validatePrice(value);
};

export const validateRadius = (value: number | null) => {
    if (value == null) {
        return null;
    }
    if (Number.isNaN(value)) {
        return 'Укажите корректный радиус.';
    }
    if (value < VALIDATION_LIMITS.radiusMin) {
        return `Радиус должен быть не меньше ${VALIDATION_LIMITS.radiusMin} км.`;
    }
    if (value > VALIDATION_LIMITS.radiusMax) {
        return `Радиус должен быть не больше ${VALIDATION_LIMITS.radiusMax} км.`;
    }

    return null;
};

export const validatePriceRange = (
    minPrice: number | null,
    maxPrice: number | null
) => {
    const minError = validateOptionalPrice(minPrice);
    if (minError) {
        return minError;
    }

    const maxError = validateOptionalPrice(maxPrice);
    if (maxError) {
        return maxError;
    }

    if (
        minPrice != null &&
        maxPrice != null &&
        minPrice > maxPrice
    ) {
        return 'Минимальная цена не может быть больше максимальной.';
    }

    return null;
};

export const validateRequiredSelection = (
    value: string,
    label: string
) => {
    if (!value) {
        return `Выберите значение поля "${label}".`;
    }

    return null;
};

export const validateImageFiles = (
    newFiles: File[],
    existingCount = 0
) => {
    if (existingCount + newFiles.length > VALIDATION_LIMITS.maxImageCount) {
        return `Можно загрузить не больше ${VALIDATION_LIMITS.maxImageCount} фотографий.`;
    }

    for (const file of newFiles) {
        const extension = file.name
            .slice(file.name.lastIndexOf('.'))
            .toLowerCase();

        if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
            return 'Разрешены файлы JPG, PNG, WEBP, GIF, BMP и AVIF.';
        }
        if (
            file.type &&
            !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)
        ) {
            return 'Разрешены файлы JPG, PNG, WEBP, GIF, BMP и AVIF.';
        }
        if (file.size > VALIDATION_LIMITS.maxImageSizeBytes) {
            return 'Размер одного изображения не должен превышать 10 МБ.';
        }
    }

    return null;
};

export const getApiErrorMessage = (
    error: unknown,
    fallbackMessage: string
) => {
    if (typeof error !== 'object' || error === null) {
        return fallbackMessage;
    }

    const response = (
        error as {
            response?: {
                data?: unknown;
            };
            message?: unknown;
        }
    ).response;

    if (typeof response?.data === 'string' && response.data.trim()) {
        return response.data;
    }

    if (
        response?.data &&
        typeof response.data === 'object' &&
        'title' in response.data &&
        typeof response.data.title === 'string'
    ) {
        return response.data.title;
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
        return message;
    }

    return fallbackMessage;
};
