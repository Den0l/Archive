import { CategoryHierarchy } from '@/types/api/categories';

export interface CategoryDropdownOption {
    id: string;
    name: string;
    level: number;
}

export const flattenCategoryHierarchy = (
    categories: CategoryHierarchy[],
    parentPath: string[] = [],
    level = 0
): CategoryDropdownOption[] => {
    const sourceCategories =
        parentPath.length === 0
            ? categories.filter((category) => !category.parentCategory)
            : categories;

    return sourceCategories.flatMap((category) => {
        const path = [...parentPath, category.name];
        const currentOption: CategoryDropdownOption = {
            id: category.id,
            name: path.join(' / '),
            level,
        };

        return [
            currentOption,
            ...flattenCategoryHierarchy(
                category.childrenCategories,
                path,
                level + 1
            ),
        ];
    });
};
