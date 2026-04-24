'use client';

import { useState } from 'react';
import { normalizeSingleLine, validateEntityName } from '@/utils/validation';
import AdminActionsMenu from '../AdminActionsMenu';

interface ListingPropertyValueItemProps {
    value: { id: string; name: string };
    onDelete: (valueId: string) => boolean | Promise<boolean>;
    onEdit: (valueId: string, name: string) => boolean | Promise<boolean>;
}

export default function ListingPropertyValueItem({
    value,
    onDelete,
    onEdit,
}: ListingPropertyValueItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(value.name);
    const [error, setError] = useState('');

    const handleEdit = async () => {
        const normalizedName = normalizeSingleLine(newName);
        const validationError = validateEntityName(
            'Название значения',
            normalizedName
        );

        setNewName(normalizedName);
        setError(validationError || '');
        if (validationError) {
            return;
        }

        const isSaved = await onEdit(value.id, normalizedName);
        if (isSaved) {
            setIsEditing(false);
        }
    };

    return (
        <li className="d-flex justify-content-between align-items-center mb-2 w-100 admin-property-value-item">
            {isEditing ? (
                <div className="d-flex flex-grow-1 gap-2 flex-wrap admin-property-value-item__edit">
                    <div className="flex-grow-1 admin-property-value-item__edit-input">
                        <input
                            type="text"
                            className={`form-control flex-grow-1 ${
                                error ? 'is-invalid' : ''
                            }`}
                            value={newName}
                            onChange={(e) => {
                                setNewName(e.target.value);
                                setError('');
                            }}
                            onBlur={() => {
                                const normalized =
                                    normalizeSingleLine(newName);
                                setNewName(normalized);
                                setError(
                                    validateEntityName(
                                        'Название значения',
                                        normalized
                                    ) || ''
                                );
                            }}
                            placeholder="Название значения"
                            aria-invalid={Boolean(error)}
                        />
                        <div className="invalid-feedback d-block field-error-slot">
                            {error || '\u00A0'}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void handleEdit()}
                    >
                        Подтвердить
                    </button>
                </div>
            ) : (
                <>
                    <span className="me-auto admin-property-value-item__name">{value.name}</span>
                    <AdminActionsMenu className="d-flex gap-2 admin-property-value-item__actions">
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                                setNewName(value.name);
                                setError('');
                                setIsEditing(true);
                            }}
                        >
                            Редактировать
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => void onDelete(value.id)}
                        >
                            Удалить
                        </button>
                    </AdminActionsMenu>
                </>
            )}
        </li>
    );
}
