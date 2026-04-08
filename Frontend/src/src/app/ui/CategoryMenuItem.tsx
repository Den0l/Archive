'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CategoryHierarchy } from '@/types/api/categories';
import { useRouter } from 'next/navigation';

interface CategoryMenuItemProps {
    category: CategoryHierarchy;
    closeNavbar: () => void;
    openedPath: string[];
    setOpenedPath: (path: string[]) => void;
    path: string[];
}

export default function CategoryMenuItem({
    category,
    closeNavbar: closeNav,
    openedPath,
    setOpenedPath,
    path,
}: CategoryMenuItemProps) {
    const hasChildren = category.childrenCategories.length > 0;
    const router = useRouter();

    const open = openedPath.length >= path.length && openedPath.every((id, idx) => path[idx] === id);

    const toggleSubmenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (open) {
            setOpenedPath(path.slice(0, -1));
        } else {
            setOpenedPath(path);
        }
    };
    const handleCategoryClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        closeNav();
        router.push(`/category/${encodeURIComponent(category.name)}`);
    };
    const closeThisMenu = () => {
        setOpenedPath(path.slice(0, -1));
    };

    return (
        <li className={`dropdown-submenu`}>
            <div className="d-flex align-items-center justify-content-between px-2 py-1">
                <a
                    href="#"
                    className="dropdown-item"
                    onClick={handleCategoryClick}
                >
                    {category.name}
                </a>

                {hasChildren && (
                    <button
                        type="button"
                        className="submenu-toggler btn p-0"
                        aria-expanded={open}
                        onClick={toggleSubmenu}
                    >
                        <ChevronRight
                            size={16}
                            style={{
                                transform: open
                                    ? 'rotate(90deg)'
                                    : 'rotate(0deg)',
                                transition: 'transform 150ms',
                            }}
                        />
                    </button>
                )}
            </div>

            {hasChildren && (
                <ul
                    className="dropdown-menu"
                    style={{ display: open ? 'block' : 'none' }}
                >
                    {category.childrenCategories.map((child) => (
                        <CategoryMenuItem
                            key={child.id}
                            category={child}
                            closeNavbar={closeThisMenu}
                            openedPath={openedPath}
                            setOpenedPath={setOpenedPath}
                            path={[...path, child.id]}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}
