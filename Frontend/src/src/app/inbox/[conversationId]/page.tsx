'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/sharedComponents/RequireAuth';

function LegacyConversationRedirect({
    params,
}: {
    params: { conversationId: string };
}) {
    const router = useRouter();

    useEffect(() => {
        router.replace(
            `/inbox?conversationId=${encodeURIComponent(params.conversationId)}`
        );
    }, [params.conversationId, router]);

    return (
        <div className="container mt-4 text-muted">
            Перенаправляем в чат...
        </div>
    );
}

export default function ConversationPage({
    params,
}: {
    params: { conversationId: string };
}) {
    return (
        <RequireAuth>
            <LegacyConversationRedirect params={params} />
        </RequireAuth>
    );
}

