'use client';

import { useEffect, useState } from 'react';
import ListingPropertyForm from './ListingPropertyForm';
import ListingPropertyItem from './ListingPropertyItem';
import {
    fetchListingProperties,
    createListingProperty,
    deleteListingProperty,
    updateListingProperty,
    addPropertyValuesToProperty,
} from '@/services/listingPropertyService';
import {
    CreateListingPropertyRequest,
    ListingPropertyDetail,
} from '@/types/api/listingProperties';
import {
    deleteListingPropertyValue,
    updateListingPropertyValue,
} from '@/services/listingPropertyValueService';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { useNotification } from '@/context/NotificationContext';
import { getApiErrorMessage } from '@/utils/validation';

export default function ListingPropertySection() {
    const [listingProperties, setListingProperties] = useState<
        ListingPropertyDetail[]
    >([]);
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();

    useEffect(() => {
        const getListingProperties = async () => {
            try {
                const res = await fetchListingProperties();
                setListingProperties(res);
            } catch (error) {
                console.error('Failed to fetch listing properties', error);
                addNotification(
                    getApiErrorMessage(
                        error,
                        'Не удалось загрузить характеристики объявлений.'
                    ),
                    { level: 'error', importance: 'high' }
                );
            }
        };
        void getListingProperties();
    }, [addNotification]);

    const handleAddProperty = async (name: string): Promise<boolean> => {
        const shouldCreate = await confirm({
            title: 'Добавление характеристики',
            message: `Добавить характеристику «${name}»?`,
            confirmText: 'Добавить',
            cancelText: 'Отмена',
            variant: 'primary',
        });

        if (!shouldCreate) {
            return false;
        }

        try {
            const request: CreateListingPropertyRequest = {
                name: name,
            };
            await createListingProperty(request);
            const res = await fetchListingProperties();
            setListingProperties(res);
            addNotification('Характеристика успешно создана.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to add listing property', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось создать характеристику объявления.'
                ),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    const handleDeleteProperty = async (propertyId: string): Promise<boolean> => {
        const targetPropertyName =
            listingProperties.find((property) => property.id === propertyId)
                ?.name ?? null;
        const shouldDelete = await confirm({
            title: 'Удаление характеристики',
            message: targetPropertyName
                ? `Удалить характеристику «${targetPropertyName}»?`
                : 'Удалить выбранную характеристику?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });

        if (!shouldDelete) {
            return false;
        }

        try {
            await deleteListingProperty(propertyId);
            const res = await fetchListingProperties();
            setListingProperties(res);
            addNotification('Характеристика успешно удалена.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to delete listing property', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось удалить характеристику объявления.'
                ),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    const handleEditProperty = async (
        propertyId: string,
        name: string
    ): Promise<boolean> => {
        const shouldEdit = await confirm({
            title: 'Редактирование характеристики',
            message: `Сохранить новое название «${name}»?`,
            confirmText: 'Сохранить',
            cancelText: 'Отмена',
            variant: 'primary',
        });

        if (!shouldEdit) {
            return false;
        }

        try {
            await updateListingProperty(propertyId, { name });
            const res = await fetchListingProperties();
            setListingProperties(res);
            addNotification('Характеристика успешно обновлена.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to update listing property', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось обновить характеристику объявления.'
                ),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    const handleAddValue = async (
        propertyId: string,
        valueName: string
    ): Promise<boolean> => {
        const shouldCreate = await confirm({
            title: 'Добавление значения',
            message: `Добавить значение «${valueName}»?`,
            confirmText: 'Добавить',
            cancelText: 'Отмена',
            variant: 'primary',
        });

        if (!shouldCreate) {
            return false;
        }

        try {
            await addPropertyValuesToProperty(propertyId, [
                { name: valueName },
            ]);
            const res = await fetchListingProperties();
            setListingProperties(res);
            addNotification('Значение характеристики успешно добавлено.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to add listing property value', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось добавить значение характеристики.'
                ),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    const handleDeleteValue = async (valueId: string): Promise<boolean> => {
        const targetValueName =
            listingProperties
                .flatMap((property) => property.listingPropertyValues)
                .find((value) => value.id === valueId)?.name ?? null;
        const shouldDelete = await confirm({
            title: 'Удаление значения',
            message: targetValueName
                ? `Удалить значение «${targetValueName}»?`
                : 'Удалить выбранное значение?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });

        if (!shouldDelete) {
            return false;
        }

        try {
            await deleteListingPropertyValue(valueId);
            const res = await fetchListingProperties();
            setListingProperties(res);
            addNotification('Значение характеристики успешно удалено.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to delete listing property value', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось удалить значение характеристики.'
                ),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    const handleEditValue = async (
        valueId: string,
        name: string
    ): Promise<boolean> => {
        const shouldEdit = await confirm({
            title: 'Редактирование значения',
            message: `Сохранить новое значение «${name}»?`,
            confirmText: 'Сохранить',
            cancelText: 'Отмена',
            variant: 'primary',
        });

        if (!shouldEdit) {
            return false;
        }

        try {
            await updateListingPropertyValue(valueId, { name });
            const res = await fetchListingProperties();
            setListingProperties(res);
            addNotification('Значение характеристики успешно обновлено.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to update listing property value', error);
            addNotification(
                getApiErrorMessage(
                    error,
                    'Не удалось обновить значение характеристики.'
                ),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    return (
        <div className="mt-4 admin-property-section">
            <h2>Управление характеристиками объявлений</h2>
            <ListingPropertyForm onSubmit={handleAddProperty} />
            <ul className="list-unstyled mt-4">
                {listingProperties.map((property) => (
                    <ListingPropertyItem
                        key={property.id}
                        property={property}
                        onDelete={handleDeleteProperty}
                        onEdit={handleEditProperty}
                        onAddValue={handleAddValue}
                        onDeleteValue={handleDeleteValue}
                        onEditValue={handleEditValue}
                    />
                ))}
            </ul>
        </div>
    );
}
