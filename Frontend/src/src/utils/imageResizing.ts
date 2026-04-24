const MAX_UPLOAD_IMAGE_DIMENSION = 1000;

const SUPPORTED_OUTPUT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

const EXTENSION_BY_TYPE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

const HEIF_MIME_TYPES = new Set([
    'image/heif',
    'image/heic',
    'image/heif-sequence',
    'image/heic-sequence',
]);

const HEIF_EXTENSIONS = new Set(['heif', 'heic']);

const getFileExtension = (fileName: string) => {
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1 || dotIndex === fileName.length - 1) {
        return '';
    }

    return fileName.slice(dotIndex + 1).toLowerCase();
};

const isHeifFile = (file: File) =>
    HEIF_MIME_TYPES.has(file.type.toLowerCase()) ||
    HEIF_EXTENSIONS.has(getFileExtension(file.name));

const loadImageElement = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Не удалось прочитать изображение.'));
        };

        image.src = objectUrl;
    });

const buildResizedFileName = (sourceName: string, targetType: string): string => {
    const extension = EXTENSION_BY_TYPE[targetType];
    const lastDotIndex = sourceName.lastIndexOf('.');
    const baseName =
        lastDotIndex > 0 ? sourceName.slice(0, lastDotIndex) : sourceName;

    return extension ? `${baseName}.${extension}` : sourceName;
};

const canvasToBlob = (
    canvas: HTMLCanvasElement,
    fileType: string,
    quality?: number
): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Не удалось подготовить изображение.'));
                    return;
                }

                resolve(blob);
            },
            fileType,
            quality
        );
    });

export const resizeImageFileIfNeeded = async (
    file: File,
    maxDimension = MAX_UPLOAD_IMAGE_DIMENSION
): Promise<File> => {
    let image: HTMLImageElement;
    try {
        image = await loadImageElement(file);
    } catch (error) {
        if (isHeifFile(file)) {
            // HEIF/HEIC can be unsupported in some browsers: keep original file.
            return file;
        }
        throw error;
    }
    const maxSide = Math.max(image.width, image.height);

    if (maxSide <= maxDimension) {
        return file;
    }

    const scale = maxDimension / maxSide;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Не удалось подготовить изображение.');
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const targetType = SUPPORTED_OUTPUT_TYPES.has(file.type)
        ? file.type
        : 'image/jpeg';
    const blob = await canvasToBlob(
        canvas,
        targetType,
        targetType === 'image/png' ? undefined : 0.9
    );

    return new File([blob], buildResizedFileName(file.name, targetType), {
        type: targetType,
        lastModified: Date.now(),
    });
};

export const resizeImageFilesIfNeeded = async (
    files: File[],
    maxDimension = MAX_UPLOAD_IMAGE_DIMENSION
): Promise<File[]> =>
    Promise.all(
        files.map((file) => resizeImageFileIfNeeded(file, maxDimension))
    );

export { MAX_UPLOAD_IMAGE_DIMENSION };
