'use client';

import { useState } from 'react';
import ListingPropertyValueForm from './ListingPropertyValueForm';
import ListingPropertyValueItem from './ListingPropertyValueItem';
import { normalizeSingleLine, validateEntityName } from '@/utils/validation';

interface ListingPropertyItemProps {
    property: {
        id: string;
        name: string;
        listingPropertyValues: { id: string; name: string }[];
    };
    onDelete: (propertyId: string) => void;
    onEdit: (propertyId: string, name: string) => void;
    onAddValue: (propertyId: string, valueName: string) => void;
    onDeleteValue: (valueId: string) => void;
    onEditValue: (valueId: string, name: string) => void;
}

export default function ListingPropertyItem({
    property,
    onDelete,
    onEdit,
    onAddValue,
    onDeleteValue,
    onEditValue,
}: ListingPropertyItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(property.name);
    const [showAddValueForm, setShowAddValueForm] = useState(false);
    const [error, setError] = useState('');

    const handleEdit = () => {
        const normalizedName = normalizeSingleLine(newName);
        const validationError = validateEntityName(
            'Название характеристики',
            normalizedName
        );

        setNewName(normalizedName);
        setError(validationError || '');
        if (validationError) {
            return;
        }

        onEdit(property.id, normalizedName);
        setIsEditing(false);
    };

    return (
        <li className="mb-4 list-unstyled">
            <div className="card shadow-sm">
                <div className="card-body">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                        {isEditing ? (
                            <div className="d-flex flex-grow-1 gap-2 flex-wrap">
                                <div className="flex-grow-1">
                                    <input
                                        type="text"
                                        className={`form-control flex-grow-1 ${
                                            error ? 'is-invalid' : ''
                                        }`}
                                        value={newName}
                                        onChange={(e) =>
                                            setNewName(e.target.value)
                                        }
                                        onBlur={() => {
                                            const normalized =
                                                normalizeSingleLine(newName);
                                            setNewName(normalized);
                                            setError(
                                                validateEntityName(
                                                    'Название характеристики',
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
                            <span className="h5 mb-0">{property.name}</span>
                        )}

                        <div className="d-flex flex-wrap gap-2">
                            {!isEditing && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={() => {
                                            setNewName(property.name);
                                            setError('');
                                            setIsEditing(true);
                                        }}
                                    >
                                        Редактировать
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => onDelete(property.id)}
                                    >
                                        Удалить
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setShowAddValueForm((v) => !v)}
                            >
                                {showAddValueForm
                                    ? 'Отменить'
                                    : 'Добавить значение'}
                            </button>
                        </div>
                    </div>

                    {showAddValueForm && (
                        <div className="mt-3">
                            <ListingPropertyValueForm
                                onSubmit={(valueName) => {
                                    onAddValue(property.id, valueName);
                                    setShowAddValueForm(false);
                                }}
                            />
                        </div>
                    )}

                    {property.listingPropertyValues.length > 0 && (
                        <ul className="mt-3 ps-0">
                            {property.listingPropertyValues.map((value) => (
                                <ListingPropertyValueItem
                                    key={value.id}
                                    value={value}
                                    onDelete={onDeleteValue}
                                    onEdit={onEditValue}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </li>
    );
}
