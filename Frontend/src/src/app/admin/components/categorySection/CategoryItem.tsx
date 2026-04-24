'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CategoryHierarchy } from '@/types/api/categories';
import CategoryForm from './CategoryForm';
import AdminActionsMenu from '../AdminActionsMenu';

interface CategoryItemProps {
    category: CategoryHierarchy;
    onAddSubcategory: (name: string, parentId: string) => boolean | Promise<boolean>;
    onDeleteCategory: (categoryId: string) => boolean | Promise<boolean>;
}

export default function CategoryItem({
    category,
    onAddSubcategory,
    onDeleteCategory,
}: CategoryItemProps) {
    const router = useRouter();
    const [showAddForm, setShowAddForm] = useState(false);

    return (
        <li className="mb-3 admin-category-item">
            <div className="admin-category-item__row d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                <span className="fw-semibold">{category.name}</span>

                <AdminActionsMenu className="d-flex flex-wrap gap-2 admin-category-item__actions">
                    <button
                        className="btn btn-sm btn-secondary admin-category-item__action-btn"
                        onClick={() => setShowAddForm((prev) => !prev)}
                    >
                        {showAddForm ? 'Отмена' : 'Добавить подкатегорию'}
                    </button>
                    <button
                        className="btn btn-sm btn-danger admin-category-item__action-btn"
                        onClick={() => void onDeleteCategory(category.id)}
                    >
                        Удалить
                    </button>
                    <button
                        className="btn btn-sm btn-primary admin-category-item__action-btn"
                        onClick={() => router.push(`/admin/category/${category.id}`)}
                    >
                        Характеристики
                    </button>
                </AdminActionsMenu>
            </div>

            {showAddForm && (
                <div className="mt-2">
                    <CategoryForm
                        onSubmit={async (name) => {
                            const isSubmitted = await onAddSubcategory(
                                name,
                                category.id
                            );
                            if (isSubmitted) {
                                setShowAddForm(false);
                            }
                            return isSubmitted;
                        }}
                        placeholder="Название подкатегории"
                    />
                </div>
            )}

            {category.childrenCategories.length > 0 && (
                <ul className="ps-4 ms-2 border-start border-2 border-secondary mt-2 admin-category-item__children">
                    {category.childrenCategories.map((child) => (
                        <CategoryItem
                            key={child.id}
                            category={child}
                            onAddSubcategory={onAddSubcategory}
                            onDeleteCategory={onDeleteCategory}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}
