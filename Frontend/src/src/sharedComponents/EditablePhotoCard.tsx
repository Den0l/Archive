type EditablePhotoCardProps = {
    imageUrl?: string;
    imageAlt: string;
    name?: string;
    onRemove: () => void;
    onRemoveBackground: () => void;
    removeLabel?: string;
    isBusy?: boolean;
    disableActions?: boolean;
};

export default function EditablePhotoCard({
    imageUrl,
    imageAlt,
    name,
    onRemove,
    onRemoveBackground,
    removeLabel = 'Удалить',
    isBusy = false,
    disableActions = false,
}: EditablePhotoCardProps) {
    return (
        <div className="photo-card">
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt={imageAlt}
                    className="photo-card__image"
                />
            )}
            {name && (
                <div className="small text-truncate text-center photo-card__name">
                    {name}
                </div>
            )}
            <div className="photo-card__actions">
                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm photo-card__button"
                    onClick={onRemoveBackground}
                    disabled={disableActions}
                >
                    {isBusy ? 'Убираем фон...' : 'Убрать фон'}
                </button>
                <button
                    type="button"
                    className="btn btn-outline-danger btn-sm photo-card__button"
                    onClick={onRemove}
                    disabled={disableActions}
                >
                    {removeLabel}
                </button>
            </div>
        </div>
    );
}
