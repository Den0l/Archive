import { getData, postData } from './httpClient';
import {
    Conversation,
    CreateConversationRequest,
} from '@/types/api/conversations';
import { Message } from '@/types/api/messages';

export const createConversation = async (
    payload: CreateConversationRequest
): Promise<Conversation> => {
    return postData<Conversation, CreateConversationRequest>(
        '/api/Conversations',
        payload
    );
};

export const fetchAllConversations = async (): Promise<Conversation[]> => {
    return getData<Conversation[]>('/api/Conversations');
};

export const fetchConversationById = async (
    conversationId: string
): Promise<Conversation> => {
    return getData<Conversation>(
        `/api/Conversations/${conversationId}`
    );
};

export const fetchMessagesByConversationId = async (
    conversationId: string
): Promise<Message[]> => {
    return getData<Message[]>(
        `/api/Conversations/${conversationId}/messages`
    );
};

export interface EnsureSystemConversationResponse {
    conversationId: string | null;
    systemUserId: string;
}

export const ensureSystemConversation =
    async (): Promise<EnsureSystemConversationResponse> => {
        return postData<EnsureSystemConversationResponse>(
            '/api/Conversations/ensure-system'
        );
    };

export const fetchSystemUserId = async (): Promise<string> => {
    const data = await getData<{ systemUserId: string }>(
        '/api/Conversations/system-user-id'
    );
    return data.systemUserId;
};
