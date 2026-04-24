'use client';

import { useEffect, useState } from 'react';
import CategoryForm from './CategoryForm';
import CategoryTree from './CategoryTree';
import {
    CategoryHierarchy,
    CreateCategoryRequest,
} from '@/types/api/categories';
import {
    fetchCategoryHierarchy,
    createCategory,
    deleteCategory,
} from '@/services/categoryService';
import { useConfirmDialog } from '@/context/ConfirmDialogContext';
import { useNotification } from '@/context/NotificationContext';
import { getApiErrorMessage } from '@/utils/validation';

export default function CategorySection() {
    const [categories, setCategories] = useState<CategoryHierarchy[]>([]);
    const { addNotification } = useNotification();
    const { confirm } = useConfirmDialog();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetchCategoryHierarchy();
                setCategories(res);
            } catch (error) {
                console.error('Failed to fetch categories', error);
                addNotification(
                    getApiErrorMessage(error, 'Не удалось загрузить категории.'),
                    { level: 'error', importance: 'high' }
                );
            }
        };

        void fetchCategories();
    }, [addNotification]);

    const refreshCategories = async () => {
        const res = await fetchCategoryHierarchy();
        setCategories(res);
    };

    const handleAddCategory = async (
        name: string,
        parentId: string | null = null
    ): Promise<boolean> => {
        const shouldCreate = await confirm({
            title: 'Добавление категории',
            message: parentId
                ? `Добавить подкатегорию «${name}»?`
                : `Добавить категорию «${name}»?`,
            confirmText: 'Добавить',
            cancelText: 'Отмена',
            variant: 'primary',
        });

        if (!shouldCreate) {
            return false;
        }

        try {
            const request: CreateCategoryRequest = {
                name,
                parentCategoryId: parentId,
            };
            await createCategory(request);
            await refreshCategories();
            addNotification('Категория успешно создана.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to add category', error);
            addNotification(
                getApiErrorMessage(error, 'Не удалось создать категорию.'),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    const handleDeleteCategory = async (categoryId: string): Promise<boolean> => {
        const findCategoryNameById = (
            tree: CategoryHierarchy[],
            id: string
        ): string | null => {
            for (const item of tree) {
                if (item.id === id) {
                    return item.name;
                }
                const nestedName = findCategoryNameById(
                    item.childrenCategories,
                    id
                );
                if (nestedName) {
                    return nestedName;
                }
            }
            return null;
        };

        const targetCategoryName = findCategoryNameById(categories, categoryId);
        const shouldDelete = await confirm({
            title: 'Удаление категории',
            message: targetCategoryName
                ? `Удалить категорию «${targetCategoryName}»?`
                : 'Удалить выбранную категорию?',
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            variant: 'danger',
        });

        if (!shouldDelete) {
            return false;
        }

        try {
            await deleteCategory(categoryId);
            await refreshCategories();
            addNotification('Категория успешно удалена.', {
                level: 'success',
            });
            return true;
        } catch (error) {
            console.error('Failed to delete category', error);
            addNotification(
                getApiErrorMessage(error, 'Не удалось удалить категорию.'),
                { level: 'error', importance: 'high' }
            );
            return false;
        }
    };

    return (
        <div className="admin-panel">
            <div className="card-admin">
                <div className="card-body">
                    <h2 className="card-title mb-3">Создать категорию вещей</h2>
                    <CategoryForm
                        onSubmit={(name: string) =>
                            handleAddCategory(name, null)
                        }
                    />

                    <hr className="my-4" />

                    <h2 className="card-title mb-2">Категории</h2>
                    <CategoryTree
                        categories={categories}
                        onAddSubcategory={handleAddCategory}
                        onDeleteCategory={handleDeleteCategory}
                    />
                </div>
            </div>
        </div>
    );
}
