'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CitySelector from './CitySelector';
import { City } from '@/types/api/cities';
import { StateOfItem } from '@/types/api/stateOfItem';
import {
    CategoryHierarchy,
    CategoryDetail,
    ListingFilter,
    Ordering,
    OrderingDirection,
} from '@/types/api/categories';
import {
    fetchCategoryHierarchy,
    fetchCategoryByName,
} from '@/services/categoryService';
import { fetchStatesOfItem } from '@/services/stateOfItemService';
import {
    normalizeSingleLine,
    validatePriceRange,
    validateRadius,
    validateSearchText,
    VALIDATION_LIMITS,
} from '@/utils/validation';

const FILTER_DEBOUNCE_MS = 450;
type CategoryOption = { name: string; label: string; path: string };
const parseIntegerFilterPrice = (value: string) => {
    if (!value) {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCategoryName = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const sortCategoryHierarchy = (
    nodes: CategoryHierarchy[]
): CategoryHierarchy[] =>
    [...nodes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((node) => ({
            ...node,
            childrenCategories: sortCategoryHierarchy(node.childrenCategories),
        }));

const collectChildCategoryIds = (nodes: CategoryHierarchy[]): Set<string> => {
    const ids = new Set<string>();

    const walk = (items: CategoryHierarchy[]) => {
        items.forEach((item) => {
            item.childrenCategories.forEach((child) => ids.add(child.id));
            walk(item.childrenCategories);
        });
    };

    walk(nodes);
    return ids;
};

const findCategoryPath = (
    nodes: CategoryHierarchy[],
    targetName: string,
    path: string[] = []
): string[] | null => {
    for (const node of nodes) {
        const nextPath = [...path, node.name];
        if (node.name === targetName) {
            return nextPath;
        }

        const childPath = findCategoryPath(
            node.childrenCategories,
            targetName,
            nextPath
        );
        if (childPath) {
            return childPath;
        }
    }

    return null;
};

const flattenSubcategories = (
    nodes: CategoryHierarchy[],
    depth = 0,
    parentPath = ''
): CategoryOption[] =>
    nodes.flatMap((node) => {
        const prefix = depth > 0 ? `${'-- '.repeat(depth)}` : '';
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        return [
            { name: node.name, label: `${prefix}${node.name}`, path: currentPath },
            ...flattenSubcategories(
                node.childrenCategories,
                depth + 1,
                currentPath
            ),
        ];
    });

interface FilterPanelProps {
    categoryName: string | null;
    priceEnabled?: boolean;
    stateOfItemEnabled?: boolean;
    listingPropertiesEnabled?: boolean;
    cityEnabled?: boolean;
    radiusEnabled?: boolean;
    searchEnabled?: boolean;
    orderingEnabled?: boolean;
    mobileCategorySelectionEnabled?: boolean;
    onFilterSubmit: (filter: ListingFilter) => void;
}

export function FilterPanel({
    categoryName,
    priceEnabled = true,
    stateOfItemEnabled = false,
    listingPropertiesEnabled = false,
    cityEnabled = false,
    radiusEnabled = false,
    searchEnabled = false,
    orderingEnabled = true,
    mobileCategorySelectionEnabled = false,
    onFilterSubmit,
}: FilterPanelProps) {
    const router = useRouter();
    const normalizedCategoryName = categoryName
        ? normalizeCategoryName(categoryName)
        : '';

    // current filter state
    const [priceMin, setPriceMin] = useState<number | null>(null);
    const [priceMax, setPriceMax] = useState<number | null>(null);
    const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
    const [selectedPropertyValuesByProperty, setSelectedPropertyValuesByProperty] =
        useState<Record<string, string[]>>({});
    const [isStateSectionExpanded, setIsStateSectionExpanded] = useState(false);
    const [expandedPropertySections, setExpandedPropertySections] = useState<
        Record<string, boolean>
    >({});
    const [city, setCity] = useState<City | null>(null);
    const [radius, setRadius] = useState<number | null>(null);
    const [search, setSearch] = useState<string | null>(null);
    const [ordering, setOrdering] = useState<Ordering>(Ordering.CreatedAt);
    const [orderingDirection, setOrderingDirection] =
        useState<OrderingDirection>(OrderingDirection.Descending);
    const [filterError, setFilterError] = useState('');
    const [categoryTree, setCategoryTree] = useState<CategoryHierarchy[]>([]);
    const [selectedRootCategoryName, setSelectedRootCategoryName] = useState(
        normalizedCategoryName
    );
    const [selectedSubCategoryName, setSelectedSubCategoryName] = useState('');

    // filter options for state of item and properties of category
    const [statesOfItem, setStatesOfItem] = useState<StateOfItem[]>([]);
    const [categoryDetail, setCategoryDetail] = useState<CategoryDetail | null>(
        null
    );

    const lastSubmittedFilterRef = useRef(
        JSON.stringify({
            priceMin: null,
            priceMax: null,
            sellerId: null,
            cityId: null,
            radius: null,
            search: null,
            ordering: Ordering.CreatedAt,
            orderingDirection: OrderingDirection.Descending,
            stateOfItemIds: [],
            selectedListingPropertyValueIds: [],
        } satisfies ListingFilter)
    );

    useEffect(() => {
        if (!mobileCategorySelectionEnabled) {
            return;
        }

        fetchCategoryHierarchy()
            .then((data) => {
                const sortedTree = sortCategoryHierarchy(data);
                const childCategoryIds = collectChildCategoryIds(sortedTree);
                const topLevelCategories = sortedTree.filter(
                    (category) => !childCategoryIds.has(category.id)
                );

                setCategoryTree(
                    topLevelCategories.length > 0 ? topLevelCategories : sortedTree
                );
            })
            .catch(console.error);
    }, [mobileCategorySelectionEnabled]);

    useEffect(() => {
        if (!mobileCategorySelectionEnabled) {
            return;
        }

        if (!normalizedCategoryName) {
            setSelectedRootCategoryName('');
            setSelectedSubCategoryName('');
            return;
        }

        if (categoryTree.length === 0) {
            setSelectedRootCategoryName((prev) => prev || normalizedCategoryName);
            return;
        }

        const path = findCategoryPath(categoryTree, normalizedCategoryName);
        if (!path || path.length === 0) {
            setSelectedRootCategoryName(normalizedCategoryName);
            setSelectedSubCategoryName('');
            return;
        }

        setSelectedRootCategoryName(path[0]);
        setSelectedSubCategoryName(path.length > 1 ? path[path.length - 1] : '');
    }, [normalizedCategoryName, categoryTree, mobileCategorySelectionEnabled]);

    useEffect(() => {
        if (categoryName && listingPropertiesEnabled) {
            fetchCategoryByName(categoryName)
                .then((data) => setCategoryDetail(data))
                .catch(console.error);
        } else if (listingPropertiesEnabled) {
            setCategoryDetail(null);
        }
        if (stateOfItemEnabled) {
            fetchStatesOfItem()
                .then((data) => setStatesOfItem(data))
                .catch(console.error);
        }
    }, [categoryName, listingPropertiesEnabled, stateOfItemEnabled]);

    useEffect(() => {
        if (!categoryDetail) {
            setSelectedPropertyValuesByProperty({});
            return;
        }

        setSelectedPropertyValuesByProperty((prev) => {
            const validPropertyIds = new Set(
                categoryDetail.listingProperties.map((property) => property.id)
            );
            const next: Record<string, string[]> = {};

            Object.entries(prev).forEach(([propertyId, valueIds]) => {
                if (!validPropertyIds.has(propertyId)) {
                    return;
                }

                const property = categoryDetail.listingProperties.find(
                    (item) => item.id === propertyId
                );
                const filteredValueIds = valueIds.filter((valueId) =>
                    property?.listingPropertyValues.some(
                        (value) => value.id === valueId
                    )
                );

                if (filteredValueIds.length > 0) {
                    next[propertyId] = filteredValueIds;
                }
            });

            return next;
        });
    }, [categoryDetail]);

    useEffect(() => {
        if (!categoryDetail) {
            setExpandedPropertySections({});
            return;
        }

        setExpandedPropertySections((prev) => {
            const next: Record<string, boolean> = {};

            categoryDetail.listingProperties.forEach((property) => {
                next[property.id] = prev[property.id] ?? false;
            });

            return next;
        });
    }, [categoryDetail]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const normalizedSearch = normalizeSingleLine(search ?? '');
            const searchError = validateSearchText(normalizedSearch);
            const priceError = validatePriceRange(priceMin, priceMax);
            const radiusError = validateRadius(radius);
            const nextError = searchError || priceError || radiusError || '';
            const selectedPropertyValues = Array.from(
                new Set(
                    Object.values(selectedPropertyValuesByProperty)
                        .flat()
                        .filter((valueId) => Boolean(valueId))
                )
            );
            const nextFilter: ListingFilter = {
                priceMin,
                priceMax,
                sellerId: null,
                cityId: city?.id ?? null,
                radius,
                search: normalizedSearch || null,
                ordering,
                orderingDirection: orderingDirection,
                stateOfItemIds: selectedStateIds,
                selectedListingPropertyValueIds: selectedPropertyValues,
            };

            setFilterError(nextError);

            if (nextError) {
                return;
            }

            const serializedFilter = JSON.stringify(nextFilter);
            if (serializedFilter === lastSubmittedFilterRef.current) {
                return;
            }

            lastSubmittedFilterRef.current = serializedFilter;
            onFilterSubmit(nextFilter);
        }, FILTER_DEBOUNCE_MS);

        return () => clearTimeout(timeoutId);
    }, [
        priceMin,
        priceMax,
        selectedStateIds,
        selectedPropertyValuesByProperty,
        city?.id,
        radius,
        search,
        ordering,
        orderingDirection,
        onFilterSubmit,
    ]);
    const handleStateToggle = (stateId: string) => {
        setSelectedStateIds((prev) =>
            prev.includes(stateId)
                ? prev.filter((id) => id !== stateId)
                : [...prev, stateId]
        );
    };

    const handlePropertyValueToggle = (propertyId: string, valueId: string) => {
        setSelectedPropertyValuesByProperty((prev) => {
            const currentValueIds = prev[propertyId] ?? [];
            const nextValueIds = currentValueIds.includes(valueId)
                ? currentValueIds.filter((id) => id !== valueId)
                : [...currentValueIds, valueId];

            if (nextValueIds.length === 0) {
                const { [propertyId]: _removed, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [propertyId]: nextValueIds,
            };
        });
    };

    const handlePropertySectionToggle = (propertyId: string) => {
        setExpandedPropertySections((prev) => ({
            ...prev,
            [propertyId]: !prev[propertyId],
        }));
    };

    const handleRootCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const nextRootCategory = event.target.value;
        setSelectedRootCategoryName(nextRootCategory);
        setSelectedSubCategoryName('');

        if (!nextRootCategory) {
            router.push('/');
            return;
        }

        router.push(`/category/${encodeURIComponent(nextRootCategory)}`);
    };

    const handleSubCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const nextSubCategory = event.target.value;
        setSelectedSubCategoryName(nextSubCategory);

        if (!selectedRootCategoryName) {
            router.push('/');
            return;
        }

        if (!nextSubCategory) {
            router.push(`/category/${encodeURIComponent(selectedRootCategoryName)}`);
            return;
        }

        router.push(`/category/${encodeURIComponent(nextSubCategory)}`);
    };

    const selectedRootCategory = categoryTree.find(
        (category) => category.name === selectedRootCategoryName
    );
    const subCategoryOptions = selectedRootCategory
        ? flattenSubcategories(selectedRootCategory.childrenCategories)
        : [];
    const shouldShowSubcategorySelect =
        Boolean(selectedRootCategoryName) &&
        (subCategoryOptions.length > 0 ||
            Boolean(selectedSubCategoryName) ||
            categoryTree.length === 0);
    const hasRootCategoryOption = categoryTree.some(
        (category) => category.name === selectedRootCategoryName
    );
    const hasSubCategoryOption = subCategoryOptions.some(
        (subcategory) => subcategory.name === selectedSubCategoryName
    );

    return (
        <div className="filter-panel">
            {mobileCategorySelectionEnabled && (
                <div className="mb-3 filter-mobile-category">
                    <h3>Главная категория</h3>
                    <select
                        className="form-control"
                        value={selectedRootCategoryName}
                        onChange={handleRootCategoryChange}
                    >
                        <option value="">Все категории</option>
                        {selectedRootCategoryName && !hasRootCategoryOption && (
                            <option value={selectedRootCategoryName}>
                                {selectedRootCategoryName}
                            </option>
                        )}
                        {categoryTree.map((category) => (
                            <option
                                key={category.id}
                                value={category.name}
                            >
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {mobileCategorySelectionEnabled && shouldShowSubcategorySelect && (
                <div className="mb-3 filter-mobile-category">
                    <h3>Подкатегория</h3>
                    <select
                        className="form-control"
                        value={selectedSubCategoryName}
                        onChange={handleSubCategoryChange}
                    >
                        <option value="">Всё</option>
                        {selectedSubCategoryName && !hasSubCategoryOption && (
                            <option value={selectedSubCategoryName}>
                                {selectedSubCategoryName}
                            </option>
                        )}
                        {subCategoryOptions.map((subcategory) => (
                            <option
                                key={subcategory.path}
                                value={subcategory.name}
                            >
                                {subcategory.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {orderingEnabled && (
                <div className="mb-3">
                    <h3>Сортировка</h3>
                    <div className="d-flex gap-2 mb-1">
                        <button
                            className={
                                ordering === Ordering.CreatedAt
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() => setOrdering(Ordering.CreatedAt)}
                        >
                            Дата
                        </button>
                        <button
                            className={
                                ordering === Ordering.Price
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() => setOrdering(Ordering.Price)}
                        >
                            Цена
                        </button>
                    </div>
                    <div className="d-flex gap-2">
                        <button
                            className={
                                orderingDirection ===
                                OrderingDirection.Ascending
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() =>
                                setOrderingDirection(
                                    OrderingDirection.Ascending
                                )
                            }
                        >
                            ↑
                        </button>
                        <button
                            className={
                                orderingDirection ===
                                OrderingDirection.Descending
                                    ? 'btn btn-primary'
                                    : 'btn btn-outline-secondary'
                            }
                            onClick={() =>
                                setOrderingDirection(
                                    OrderingDirection.Descending
                                )
                            }
                        >
                            ↓
                        </button>
                    </div>
                </div>
            )}

            {priceEnabled && (
                <div className="mb-3">
                    <h3>Цена</h3>
                    <input
                        type="number"
                        placeholder="Мин"
                        className="form-control"
                        inputMode="numeric"
                        value={priceMin ?? ''}
                        onChange={(e) =>
                            setPriceMin(parseIntegerFilterPrice(e.target.value))
                        }
                        min={VALIDATION_LIMITS.priceMin}
                        max={VALIDATION_LIMITS.priceMax}
                        step="1"
                    />
                    <input
                        type="number"
                        placeholder="Макс"
                        className="form-control"
                        inputMode="numeric"
                        value={priceMax ?? ''}
                        onChange={(e) =>
                            setPriceMax(parseIntegerFilterPrice(e.target.value))
                        }
                        min={VALIDATION_LIMITS.priceMin}
                        max={VALIDATION_LIMITS.priceMax}
                        step="1"
                    />
                </div>
            )}

            {searchEnabled && (
                <div className="mb-3">
                    <h3>Поиск</h3>
                    <input
                        placeholder="Введите название"
                        type="text"
                        className="form-control"
                        value={search ?? ''}
                        onChange={(e) => setSearch(e.target.value || null)}
                        onBlur={() =>
                            setSearch(normalizeSingleLine(search ?? '') || null)
                        }
                        maxLength={VALIDATION_LIMITS.searchMaxLength}
                    />
                </div>
            )}

            {cityEnabled && (
                <div className="mb-3">
                    <h3>Город</h3>
                    <CitySelector
                        onCitySelect={setCity}
                        placeholder="Выберите город"
                    />
                </div>
            )}

            {radiusEnabled && (
                <div className="mb-3">
                    <h3>Радиус (км)</h3>
                    <input
                        type="number"
                        className="form-control"
                        value={radius ?? ''}
                        onChange={(e) =>
                            setRadius(
                                e.target.value ? Number(e.target.value) : null
                            )
                        }
                        min={VALIDATION_LIMITS.radiusMin}
                        max={VALIDATION_LIMITS.radiusMax}
                        step="1"
                    />
                </div>
            )}

            {(stateOfItemEnabled ||
                (listingPropertiesEnabled &&
                    Boolean(categoryDetail?.listingProperties.length))) && (
                <div className="mb-3">
                    <h3>Параметры</h3>

                    {stateOfItemEnabled && (
                        <div className="mb-2 filter-parameter-item">
                            <button
                                type="button"
                                className={`filter-parameter-toggle ${
                                    isStateSectionExpanded ? 'is-open' : ''
                                }`}
                                onClick={() =>
                                    setIsStateSectionExpanded((prev) => !prev)
                                }
                                aria-expanded={isStateSectionExpanded}
                                aria-controls="filter-state-values"
                            >
                                <span className="filter-parameter-toggle__name">
                                    Состояние
                                </span>
                                <span className="filter-parameter-toggle__meta">
                                    {selectedStateIds.length > 0 && (
                                        <span className="filter-parameter-toggle__count">
                                            {selectedStateIds.length}
                                        </span>
                                    )}
                                    <span
                                        className={`filter-parameter-toggle__icon ${
                                            isStateSectionExpanded
                                                ? 'is-open'
                                                : ''
                                        }`}
                                        aria-hidden="true"
                                    >
                                        ▾
                                    </span>
                                </span>
                            </button>
                            <div
                                id="filter-state-values"
                                className={`filter-options-dropdown filter-checkbox-group ${
                                    isStateSectionExpanded
                                        ? 'is-open'
                                        : 'is-closed'
                                }`}
                                aria-hidden={!isStateSectionExpanded}
                            >
                                {statesOfItem.map((state) => {
                                    const inputId = `filter-state-${state.id}`;
                                    return (
                                        <div className="form-check" key={state.id}>
                                            <input
                                                id={inputId}
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={selectedStateIds.includes(
                                                    state.id
                                                )}
                                                onChange={() =>
                                                    handleStateToggle(state.id)
                                                }
                                            />
                                            <label
                                                className="form-check-label"
                                                htmlFor={inputId}
                                            >
                                                {state.name}
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {listingPropertiesEnabled &&
                        categoryDetail?.listingProperties.map((property) => (
                            <div
                                className="mb-2 filter-parameter-item"
                                key={property.id}
                            >
                                {(() => {
                                    const selectedValues =
                                        selectedPropertyValuesByProperty[
                                            property.id
                                        ] ?? [];
                                    const isExpanded =
                                        expandedPropertySections[property.id] ??
                                        false;

                                    return (
                                        <>
                                            <button
                                                type="button"
                                                className={`filter-parameter-toggle ${
                                                    isExpanded ? 'is-open' : ''
                                                }`}
                                                onClick={() =>
                                                    handlePropertySectionToggle(
                                                        property.id
                                                    )
                                                }
                                                aria-expanded={isExpanded}
                                                aria-controls={`filter-property-values-${property.id}`}
                                            >
                                                <span className="filter-parameter-toggle__name">
                                                    {property.name}
                                                </span>
                                                <span className="filter-parameter-toggle__meta">
                                                    {selectedValues.length > 0 && (
                                                        <span className="filter-parameter-toggle__count">
                                                            {selectedValues.length}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`filter-parameter-toggle__icon ${isExpanded ? 'is-open' : ''}`}
                                                        aria-hidden="true"
                                                    >
                                                        ▾
                                                    </span>
                                                </span>
                                            </button>

                                            <div
                                                id={`filter-property-values-${property.id}`}
                                                className={`filter-options-dropdown filter-property-values ${
                                                    isExpanded
                                                        ? 'is-open'
                                                        : 'is-closed'
                                                }`}
                                                aria-hidden={!isExpanded}
                                            >
                                                {property.listingPropertyValues.map(
                                                    (value) => {
                                                        const inputId = `filter-property-${property.id}-${value.id}`;
                                                        return (
                                                            <div
                                                                className="form-check"
                                                                key={value.id}
                                                            >
                                                                <input
                                                                    id={inputId}
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    checked={selectedValues.includes(
                                                                        value.id
                                                                    )}
                                                                    onChange={() =>
                                                                        handlePropertyValueToggle(
                                                                            property.id,
                                                                            value.id
                                                                        )
                                                                    }
                                                                />
                                                                <label
                                                                    className="form-check-label"
                                                                    htmlFor={inputId}
                                                                >
                                                                    {value.name}
                                                                </label>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        ))}
                </div>
            )}
            {filterError && (
                <div className="text-danger mb-2">{filterError}</div>
            )}
        </div>
    );
}
