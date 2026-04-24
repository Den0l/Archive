'use client';

import CategoryItem from './CategoryItem';
import { CategoryHierarchy } from '@/types/api/categories';

interface CategoryTreeProps {
    categories: CategoryHierarchy[];
    onAddSubcategory: (name: string, parentId: string) => boolean | Promise<boolean>;
    onDeleteCategory: (categoryId: string) => boolean | Promise<boolean>;
}

export default function CategoryTree({
    categories,
    onAddSubcategory,
    onDeleteCategory,
}: CategoryTreeProps) {
    return (
        <ul className="list-unstyled mt-4">
            {categories
                .filter((category) => !category.parentCategory) // only top level categories
                .map((category) => (
                    <CategoryItem
                        key={category.id}
                        category={category}
                        onAddSubcategory={onAddSubcategory}
                        onDeleteCategory={onDeleteCategory}
                    />
                ))}
        </ul>
    );
}
