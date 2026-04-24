'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fetchCategoryHierarchy } from '@/services/categoryService';
import { CategoryHierarchy } from '@/types/api/categories';
import CategoryMenuItem from './CategoryMenuItem';

type CategoryPath = string[];

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoriteContext';
import { useMessageNotifications } from '@/context/MessageNotificationContext';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopMenu() {
    const [categories, setCategories] = useState<CategoryHierarchy[]>([]);
    const [navOpen, setNavOpen] = useState<boolean>(false);
    const [categoriesOpen, setCategoriesOpen] = useState<boolean>(false);
    const [profileOpen, setProfileOpen] = useState<boolean>(false);
    const [openedPath, setOpenedPath] = useState<CategoryPath>([]);
    const categoriesMenuRef = useRef<HTMLLIElement | null>(null);
    const profileMenuRef = useRef<HTMLLIElement | null>(null);
    const { user, logout } = useAuth();
    const { totalItems: cartCount } = useCart();
    const { totalItems: favoriteCount } = useFavorites();
    const { hasUnreadMessages } = useMessageNotifications();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetchCategoryHierarchy();
                setCategories(res);
            } catch (error) {
                console.error('Failed to fetch categories', error);
            }
        };

        fetchCategories();
    }, []);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;

            if (
                categoriesOpen &&
                categoriesMenuRef.current &&
                !categoriesMenuRef.current.contains(target)
            ) {
                setCategoriesOpen(false);
                setOpenedPath([]);
            }

            if (
                profileOpen &&
                profileMenuRef.current &&
                !profileMenuRef.current.contains(target)
            ) {
                setProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [categoriesOpen, profileOpen]);

    const closeNav = () => {
        setNavOpen(false);
        setCategoriesOpen(false);
        setProfileOpen(false);
        setOpenedPath([]);
    };

    const topLevelCategories = categories.filter((c) => !c.parentCategory);

    const renderCategoryMenu = (category: CategoryHierarchy) => {
        const hasSubcategories = category.childrenCategories.length > 0;

        return (
            <li
                key={category.id}
                className={`dropdown-submenu ${hasSubcategories ? 'dropend' : ''}`}
            >
                <Link
                    href={`/category/${category.name}`}
                    className={`dropdown-item ${hasSubcategories ? 'dropdown-toggle' : ''}`}
                    onClick={closeNav}
                >
                    {category.name}
                </Link>
                {hasSubcategories && (
                    <ul className="dropdown-menu">
                        {category.childrenCategories.map((subCategory) =>
                            renderCategoryMenu(subCategory)
                        )}
                    </ul>
                )}
            </li>
        );
    };

    const isCartActive =
        pathname === '/cart' && searchParams.get('tab') !== 'favorites';
    const isFavoritesActive =
        pathname === '/cart' && searchParams.get('tab') === 'favorites';

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <button
                    className="navbar-toggle"
                    type="button"
                    onClick={() => setNavOpen((open) => !open)}
                    aria-label="Открыть меню"
                    aria-expanded={navOpen}
                >
                    ☰
                </button>
                <Link
                    href="/"
                    className="navbar-brand"
                    style={{ fontSize: '24px', fontWeight: 'bold' }}
                    onClick={closeNav}
                >
                    {process.env.NEXT_PUBLIC_MARKETPLACE_NAME}
                </Link>
            </div>
            
            <div className={`navbar-collapse burger-menu ${navOpen ? 'open' : ''}`}>
                <div className="navbar-center">
                    <ul className="navbar-nav">
                        <li
                            className="nav-item"
                            ref={categoriesMenuRef}
                        >
                            <button
                                className="nav-link dropdown-toggle"
                                type="button"
                                onClick={() => setCategoriesOpen((c) => !c)}
                                aria-expanded={categoriesOpen}>
                                Категории
                            </button>
                            <ul
                                className={`dropdown-menu ${categoriesOpen ? 'show' : ''}`}
                            >
                                {topLevelCategories.map((cat) => (
                                    <CategoryMenuItem
                                        key={cat.id}
                                        category={cat}
                                        closeNavbar={closeNav}
                                        openedPath={openedPath}
                                        setOpenedPath={setOpenedPath}
                                        path={[cat.id]}
                                    />
                                ))}
                            </ul>
                        </li>
                    </ul>
                </div>
                
                <div className="navbar-right">
                    <div className="nav-segmented">
                        <Link
                            href="/cart?tab=cart"
                            className={`nav-segment ${isCartActive ? 'active' : ''}`}
                            onClick={closeNav}
                        >
                            Корзина
                            <span
                                className={`nav-badge ${
                                    cartCount > 0 ? 'nav-badge-filled' : 'nav-badge-empty'
                                }`}
                            >
                                {cartCount}
                            </span>
                        </Link>
                        <Link
                            href="/cart?tab=favorites"
                            className={`nav-segment ${isFavoritesActive ? 'active' : ''}`}
                            onClick={closeNav}
                        >
                            Избранное
                            <span
                                className={`nav-badge ${
                                    favoriteCount > 0
                                        ? 'nav-badge-filled'
                                        : 'nav-badge-empty'
                                }`}
                            >
                                {favoriteCount}
                            </span>
                        </Link>
                    </div>

                    <ul className="navbar-nav ms-auto">
                        {user ? (
                            <>
                                <li
                                    className="nav-item nav-item-create-listing"
                                >
                                    <Link
                                        href="/listing/new"
                                        className="nav-link nav-link-create-listing"
                                        onClick={closeNav}
                                    >
                                        Создать объявление
                                    </Link>
                                </li>
                                <li
                                    className="nav-item nav-item-profile"
                                    ref={profileMenuRef}
                                >
                                    <button
                                        className="nav-link dropdown-toggle nav-link-with-dot"
                                        type="button"
                                        onClick={() => setProfileOpen((p) => !p)}
                                        aria-expanded={profileOpen}
                                    >
                                        <span>Профиль</span>
                                        {hasUnreadMessages && (
                                            <span
                                                className="nav-notification-dot"
                                                aria-label="Есть новые сообщения"
                                            />
                                        )}
                                    </button>
                                    <ul
                                        className={`dropdown-menu profile-menu ${profileOpen ? 'show' : ''}`}
                                    >
                                        <li className="profile-item-create-listing">
                                            <Link
                                                href="/listing/new"
                                                className="dropdown-item"
                                                onClick={closeNav}
                                            >
                                                Создать объявление
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href="/user"
                                                className="dropdown-item"
                                                onClick={closeNav}
                                            >
                                                Мой профиль
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href="/inbox"
                                                className="dropdown-item dropdown-item-with-dot"
                                                onClick={closeNav}
                                            >
                                                <span>Мои сообщения</span>
                                                {hasUnreadMessages && (
                                                    <span
                                                        className="nav-notification-dot"
                                                        aria-label="Есть новые сообщения"
                                                    />
                                                )}
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href="/user/orders"
                                                className="dropdown-item"
                                                onClick={closeNav}
                                            >
                                                Мои заказы
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href="/user/settings"
                                                className="dropdown-item"
                                                onClick={closeNav}
                                            >
                                                Настройки
                                            </Link>
                                        </li>
                                        {user.roles.includes('Admin') && (
                                            <li>
                                                <Link
                                                    href="/admin"
                                                    className="dropdown-item"
                                                    onClick={closeNav}
                                                >
                                                    Администрирование
                                                </Link>
                                            </li>
                                        )}
                                        <li>
                                            <Link
                                                href="/"
                                                className="dropdown-item"
                                                onClick={() => {
                                                    logout();
                                                    closeNav();
                                                }}
                                            >
                                                Выход
                                            </Link>
                                        </li>
                                    </ul>
                                </li>
                            </>
                        ) : (
                            <>
                                <li>
                                    <Link
                                        href="/auth/login"
                                        className="login"
                                        onClick={closeNav}
                                    >
                                        Вход
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/auth/register"
                                        className="login"
                                        onClick={closeNav}
                                    >
                                        Регистрация
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
}
