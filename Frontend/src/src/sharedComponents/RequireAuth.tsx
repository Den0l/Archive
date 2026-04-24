'use client';

import React, { ReactNode, useCallback } from 'react';
import {
    type RouteGuardContext,
    useRouteGuard,
} from '@/sharedComponents/hooks/useRouteGuard';

export default function RequireAuth({ children }: { children: ReactNode }) {
    const isAllowed = useCallback(({ user }: RouteGuardContext) => {
        return Boolean(user);
    }, []);

    const { user, loading } = useRouteGuard({
        redirectTo: '/auth/login',
        isAllowed,
    });

    if (loading || !user) {
        return <div className="page-loading-state">Загрузка</div>;
    }

    return <>{children}</>;
}
