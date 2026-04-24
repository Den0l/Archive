'use client';

import { useState } from 'react';
import ListingPropertyValueForm from './ListingPropertyValueForm';
import ListingPropertyValueItem from './ListingPropertyValueItem';
import { normalizeSingleLine, validateEntityName } from '@/utils/validation';
import AdminActionsMenu from '../AdminActionsMenu';

interface ListingPropertyItemProps {
    property: {
        id: string;
        name: string;
        listingPropertyValues: { id: string; name: string }[];
    };
    onDelete: (propertyId: string) => boolean | Promise<boolean>;
    onEdit: (propertyId: string, name: string) => boolean | Promise<boolean>;
    onAddValue: (propertyId: string, valueName: string) => boolean | Promise<boolean>;
    onDeleteValue: (valueId: string) => boolean | Promise<boolean>;
    onEditValue: (valueId: string, name: string) => boolean | Promise<boolean>;
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

    const handleEdit = async () => {
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

        const isSaved = await onEdit(property.id, normalizedName);
        if (isSaved) {
            setIsEditing(false);
        }
    };

    return (
        <li className="mb-4 list-unstyled admin-property-item">
            <div className="card shadow-sm">
                <div className="card-admin">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 admin-property-item__header">
                        {isEditing ? (
                            <div className="d-flex flex-grow-1 gap-2 flex-wrap admin-property-item__edit">
                                <div className="flex-grow-1 admin-property-item__edit-input">
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
                                                    'Название характеристики',
                                                    normalized
                                                ) || ''
                                            );
                                        }}
                                        placeholder="Название характеристики"
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
                            <span className="h5 mb-0">{property.name}</span>
                        )}

                        <AdminActionsMenu className="d-flex flex-wrap gap-2 admin-property-item__actions">
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
                                        onClick={() => void onDelete(property.id)}
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
                        </AdminActionsMenu>
                    </div>

                    {showAddValueForm && (
                        <div className="mt-3">
                            <ListingPropertyValueForm
                                onSubmit={async (valueName) => {
                                    const isSubmitted = await onAddValue(
                                        property.id,
                                        valueName
                                    );
                                    if (isSubmitted) {
                                        setShowAddValueForm(false);
                                    }
                                    return isSubmitted;
                                }}
                            />
                        </div>
                    )}

                    {property.listingPropertyValues.length > 0 && (
                        <ul className="mt-3 ps-0 admin-property-value-list">
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
