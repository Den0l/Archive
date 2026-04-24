'use client';

import React, { ReactNode, useCallback } from 'react';
import {
    type RouteGuardContext,
    useRouteGuard,
} from '@/sharedComponents/hooks/useRouteGuard';

export default function RequireAdmin({ children }: { children: ReactNode }) {
    const isAllowed = useCallback(({ user }: RouteGuardContext) => {
        return Boolean(user?.roles.includes('Admin'));
    }, []);

    const { user, loading } = useRouteGuard({
        redirectTo: '/',
        isAllowed,
    });

    const isAdmin = Boolean(user?.roles.includes('Admin'));

    if (loading || !user || !isAdmin) {
        return <div className="page-loading-state">Загрузка</div>;
    }

    return <>{children}</>;
}
