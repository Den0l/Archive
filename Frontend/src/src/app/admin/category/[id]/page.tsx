'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ListingPropertiesList from './components/ListingPropertiesList';
import AvailablePropertiesList from './components/AvailablePropertiesList';
import {
    fetchCategoryById,
    updateCategory,
    removeListingPropertyFromCategory,
    addListingPropertiesToCategory,
} from '@/services/categoryService';
import { CategoryDetail } from '@/types/api/categories';
import { ListingProperty } from '@/types/api/listingProperties';
import { fetchListingProperties } from '@/services/listingPropertyService';
import RequireAdmin from '@/sharedComponents/RequireAdmin';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { normalizeSingleLine, validateEntityName } from '@/utils/validation';

const CATEGORY_NAME_AUTOSAVE_DELAY_MS = 700;

type CategoryNameSaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function CategoryPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const [category, setCategory] = useState<CategoryDetail | null>(null);
    const [allProperties, setAllProperties] = useState<ListingProperty[]>([]);
    const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
    const [categoryNameDraft, setCategoryNameDraft] = useState('');
    const [categoryNameError, setCategoryNameError] = useState('');
    const [categoryNameSaveState, setCategoryNameSaveState] =
        useState<CategoryNameSaveState>('idle');
    const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    const { confirm } = useConfirmDialog();

    const fetchCategory = useCallback(async () => {
        const res = await fetchCategoryById(id);
        setCategory(res);
        setCategoryNameDraft(res.name);
        setCategoryNameError('');
    }, [id]);

    useEffect(() => {
        if (!id) {
            return;
        }

        const fetchData = async () => {
            try {
                await fetchCategory();
            } catch (error) {
                console.error('Failed to fetch category data', error);
            }

            try {
                const properties = await fetchListingProperties();
                setAllProperties(properties);
            } catch (error) {
                console.error('Failed to fetch listing properties', error);
            }
        };

        fetchData();
    }, [id, fetchCategory]);

    const persistCategoryName = useCallback(
        async (normalizedName: string) => {
            if (!category) {
                return;
            }

            try {
                setCategoryNameSaveState('saving');
                await updateCategory(category.id, { name: normalizedName });
                await fetchCategory();
                setCategoryNameSaveState('saved');
            } catch (error) {
                console.error('Failed to update category name', error);
                setCategoryNameSaveState('error');
            }
        },
        [category, fetchCategory]
    );

    useEffect(() => {
        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!category) {
            return;
        }

        const normalizedName = normalizeSingleLine(categoryNameDraft);
        const validationError = validateEntityName(
            'Название категории',
            normalizedName
        );

        if (validationError) {
            setCategoryNameError(validationError);
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
            return;
        }

        setCategoryNameError('');

        if (normalizedName === category.name) {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        autosaveTimeoutRef.current = setTimeout(() => {
            void persistCategoryName(normalizedName);
        }, CATEGORY_NAME_AUTOSAVE_DELAY_MS);
    }, [categoryNameDraft, category, persistCategoryName]);

    const handleRemoveProperty = async (propertyId: string) => {
        if (!category) return;

        const propertyName =
            category.listingProperties.find((property) => property.id === propertyId)
                ?.name ?? null;
        const shouldRemove = await confirm({
            title: 'Удаление характеристики из категории',
            message: propertyName
                ? `Удалить характеристику «${propertyName}» из категории?`
                : 'Удалить выбранную характеристику из категории?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });

        if (!shouldRemove) {
            return;
        }

        try {
            await removeListingPropertyFromCategory(category.id, {
                id: propertyId,
            });
            await fetchCategory();
        } catch (error) {
            console.error('Failed to remove property from category', error);
        }
    };

    const handleAddProperties = async () => {
        if (!category) return;

        const shouldAdd = await confirm({
            title: 'Добавление характеристик в категорию',
            message:
                selectedProperties.length === 1
                    ? 'Добавить выбранную характеристику в категорию?'
                    : `Добавить выбранные характеристики (${selectedProperties.length}) в категорию?`,
            confirmText: 'Добавить',
            cancelText: 'Отмена',
            variant: 'primary',
        });

        if (!shouldAdd) {
            return;
        }

        try {
            await addListingPropertiesToCategory(category.id, {
                listingPropertyIds: selectedProperties,
            });
            await fetchCategory();
            setSelectedProperties([]);
        } catch (error) {
            console.error('Failed to add properties to category', error);
        }
    };

    const handleCheckboxChange = (propertyId: string) => {
        if (selectedProperties.includes(propertyId)) {
            setSelectedProperties(
                selectedProperties.filter((currentId) => currentId !== propertyId)
            );
            return;
        }

        setSelectedProperties([...selectedProperties, propertyId]);
    };

    const availableProperties = allProperties.filter(
        (property) =>
            !category?.listingProperties.some(
                (tiedProperty) => tiedProperty.id === property.id
            )
    );

    const categoryNameStatusText =
        categoryNameSaveState === 'saving'
            ? 'Сохраняем...'
            : categoryNameSaveState === 'saved'
              ? 'Сохранено'
              : categoryNameSaveState === 'error'
                ? 'Не удалось сохранить. Измените поле ещё раз.'
                : '';

    if (!category) {
        return <div className="page-loading-state">Загрузка</div>;
    }

    return (
        <RequireAdmin>
            <div className="container mt-5 admin-category-page">
                <div className="admin-category-title-block">
                    <h1 className="text-center text-md-left mb-2">
                        Настройка категории
                    </h1>
                    <label
                        htmlFor="categoryName"
                        className="form-label mb-1"
                    >
                        Название категории
                    </label>
                    <input
                        id="categoryName"
                        type="text"
                        className={`form-control admin-category-name-input ${
                            categoryNameError ? 'is-invalid' : ''
                        }`}
                        value={categoryNameDraft}
                        onChange={(event) => {
                            setCategoryNameDraft(event.target.value);
                            setCategoryNameSaveState('idle');
                        }}
                        onBlur={() => {
                            setCategoryNameDraft(
                                normalizeSingleLine(categoryNameDraft)
                            );
                        }}
                        aria-label="Название категории"
                        aria-invalid={Boolean(categoryNameError)}
                    />
                    <div className="invalid-feedback d-block field-error-slot">
                        {categoryNameError || '\u00A0'}
                    </div>
                    <div className="form-text mt-0">{categoryNameStatusText}</div>
                </div>
                <div className="gx-4 gy-4">
                    <div className="col-12">
                        <div className="card h-100">
                            <div className="card-header">Список характеристик</div>
                            <div className="card-body">
                                <ListingPropertiesList
                                    listingProperties={category.listingProperties}
                                    onRemove={handleRemoveProperty}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card h-100">
                            <div className="card-header">
                                Добавить характеристику
                            </div>
                            <div className="card-body">
                                <AvailablePropertiesList
                                    availableProperties={availableProperties}
                                    selectedProperties={selectedProperties}
                                    onCheckboxChange={handleCheckboxChange}
                                    onAdd={handleAddProperties}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </RequireAdmin>
    );
}
