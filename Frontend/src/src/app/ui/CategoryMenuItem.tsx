'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
    const submenuItemRef = useRef<HTMLLIElement | null>(null);
    const submenuRef = useRef<HTMLUListElement | null>(null);
    const [openLeft, setOpenLeft] = useState(false);
    const [horizontalOffset, setHorizontalOffset] = useState(0);

    const open = openedPath.length >= path.length && path.every((id, idx) => openedPath[idx] === id);

    const updateSubmenuDirection = useCallback(() => {
        if (!hasChildren || !open || !submenuItemRef.current || !submenuRef.current) {
            return;
        }

        if (window.matchMedia('(max-width: 768px)').matches) {
            setOpenLeft(false);
            setHorizontalOffset(0);
            return;
        }

        const parentRect = submenuItemRef.current.getBoundingClientRect();
        const submenuWidth = submenuRef.current.offsetWidth;
        const viewportWidth = window.innerWidth;
        const gutter = 12;
        const availableRight = viewportWidth - parentRect.right - gutter;
        const availableLeft = parentRect.left - gutter;
        const fitsRight = submenuWidth <= availableRight;
        const fitsLeft = submenuWidth <= availableLeft;

        let nextOpenLeft = false;
        if (fitsRight) {
            nextOpenLeft = false;
        } else if (fitsLeft) {
            nextOpenLeft = true;
        } else {
            nextOpenLeft = availableLeft > availableRight;
        }

        let nextHorizontalOffset = 0;
        if (nextOpenLeft) {
            const overflowLeft = submenuWidth - availableLeft;
            if (overflowLeft > 0) {
                nextHorizontalOffset = overflowLeft;
            }
        } else {
            const overflowRight = submenuWidth - availableRight;
            if (overflowRight > 0) {
                nextHorizontalOffset = -overflowRight;
            }
        }

        setOpenLeft(nextOpenLeft);
        setHorizontalOffset(nextHorizontalOffset);
    }, [hasChildren, open]);

    useEffect(() => {
        if (!open) {
            setOpenLeft(false);
            setHorizontalOffset(0);
            return;
        }

        const rafId = window.requestAnimationFrame(updateSubmenuDirection);
        window.addEventListener('resize', updateSubmenuDirection);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updateSubmenuDirection);
        };
    }, [open, updateSubmenuDirection]);

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

    return (
        <li
            ref={submenuItemRef}
            className={`dropdown-submenu ${openLeft ? 'open-left' : ''}`}
        >
            <div className="d-flex align-items-center justify-content-between px-2 py-1">
                <a
                    href="#"
                    className="dropdown-item flex-grow-1"
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
                            size={14}
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
                    ref={submenuRef}
                    className="dropdown-menu"
                    style={{
                        display: open ? 'block' : 'none',
                        transform:
                            horizontalOffset !== 0
                                ? `translateX(${horizontalOffset}px)`
                                : undefined,
                    }}
                >
                    {category.childrenCategories.map((child) => (
                        <CategoryMenuItem
                            key={child.id}
                            category={child}
                            closeNavbar={closeNav}
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
