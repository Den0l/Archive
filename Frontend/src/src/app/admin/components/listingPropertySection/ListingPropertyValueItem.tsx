'use client';

import { useState } from 'react';
import { normalizeSingleLine, validateEntityName } from '@/utils/validation';

interface ListingPropertyValueItemProps {
    value: { id: string; name: string };
    onDelete: (valueId: string) => void;
    onEdit: (valueId: string, name: string) => void;
}

export default function ListingPropertyValueItem({
    value,
    onDelete,
    onEdit,
}: ListingPropertyValueItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(value.name);
    const [error, setError] = useState('');

    const handleEdit = () => {
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

        onEdit(value.id, normalizedName);
        setIsEditing(false);
    };

    return (
        <li className="d-flex justify-content-between align-items-center mb-2 w-100">
            {isEditing ? (
                <div className="d-flex flex-grow-1 gap-2 flex-wrap">
                    <div className="flex-grow-1">
                        <input
                            type="text"
                            className={`form-control flex-grow-1 ${
                                error ? 'is-invalid' : ''
                            }`}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
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
                            aria-invalid={Boolean(error)}
                        />
                        {error && (
                            <div className="invalid-feedback d-block">
                                {error}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleEdit}
                    >
                        Подтвердить
                    </button>
                </div>
            ) : (
                <>
                    <span className="me-auto">{value.name}</span>
                    <div className="d-flex gap-2">
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
                            onClick={() => onDelete(value.id)}
                        >
                            Удалить
                        </button>
                    </div>
                </>
            )}
        </li>
    );
}
