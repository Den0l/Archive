'use client';
import React, { useState } from 'react';
import CategorySection from './components/categorySection/CategorySection';
import ListingManagementSection from './components/ListingManagementSection';
import ListingPropertySection from './components/listingPropertySection/ListingPropertySection';
import UserManagementSection from './components/UserManagementSection';
import RequireAdmin from '@/sharedComponents/RequireAdmin';

export default function AdminPage(): JSX.Element {
    type TabKey =
        | 'categories'
        | 'properties'
        | 'listingManagement'
        | 'userManagement';
    const [activeTab, setActiveTab] = useState<TabKey>('categories');

    return (
        <RequireAdmin>
            <div className="container-admin mt-5 admin-page">
                <h1 className="text-center text-md-left mb-4">Администрирование</h1>

                <ul className="nav nav-tabs mb-4 admin-page__tabs">
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'categories' ? 'active' : ''}`}
                            onClick={() => setActiveTab('categories')}
                        >
                            Категории
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'properties' ? 'active' : ''}`}
                            onClick={() => setActiveTab('properties')}
                        >
                            Характеристики категорий
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'listingManagement' ? 'active' : ''}`}
                            onClick={() => setActiveTab('listingManagement')}
                        >
                            Управление объявлениями
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'userManagement' ? 'active' : ''}`}
                            onClick={() => setActiveTab('userManagement')}
                        >
                            Управление пользователями
                        </button>
                    </li>
                </ul>

                <div className="tab-content">
                    <div
                        className={`tab-pane fade ${activeTab === 'categories' ? 'show active' : ''}`}
                    >
                        <CategorySection />
                    </div>
                    <div
                        className={`tab-pane fade ${activeTab === 'properties' ? 'show active' : ''}`}
                    >
                        <ListingPropertySection />
                    </div>
                    <div
                        className={`tab-pane fade ${activeTab === 'listingManagement' ? 'show active' : ''}`}
                    >
                        <ListingManagementSection />
                    </div>
                    <div
                        className={`tab-pane fade ${activeTab === 'userManagement' ? 'show active' : ''}`}
                    >
                        <UserManagementSection />
                    </div>
                </div>
            </div>
        </RequireAdmin>
    );
}
