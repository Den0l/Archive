import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export type RouteGuardContext = {
    user: ReturnType<typeof useAuth>['user'];
    loading: boolean;
};

type RouteGuardOptions = {
    redirectTo: string;
    isAllowed: (params: RouteGuardContext) => boolean;
};

export const useRouteGuard = ({ redirectTo, isAllowed }: RouteGuardOptions) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) {
            return;
        }

        if (!isAllowed({ user, loading })) {
            router.replace(redirectTo);
        }
    }, [isAllowed, loading, redirectTo, router, user]);

    return { user, loading };
};
