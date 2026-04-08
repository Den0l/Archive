'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const LOADING_TEXT = '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...';

export default function UserRedirectPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (user) {
            router.replace(`/user/${user.id}`);
        } else {
            router.replace('/auth/login');
        }
    }, [loading, user, router]);

    return <div className="container mt-5">{LOADING_TEXT}</div>;
}
