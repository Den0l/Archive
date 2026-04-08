'use client';

import React, { useEffect, useState } from 'react';
import {
    fetchAllUserDetails,
    addAdminRole,
    removeAdminRole,
    deleteUser,
} from '@/services/userService';
import { UserDetail } from '@/types/api/users';

export default function UserManagementSection(): JSX.Element {
    const [users, setUsers] = useState<UserDetail[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAllUserDetails();
            setUsers(data);
        } catch (err: any) {
            setError(err.message || 'Не удалось загрузить пользователей');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleDelete = async (userId: string) => {
        if (
            !window.confirm(
                'Вы уверены, что хотите удалить этого пользователя?'
            )
        )
            return;
        try {
            await deleteUser(userId);
            setUsers((prev) => prev.filter((user) => user.id !== userId));
        } catch (err: any) {
            alert(err.message || 'Ошибка от попытки удаления');
        }
    };

    const handleAddAdmin = async (userId: string) => {
        try {
            const data = await addAdminRole(userId);
            setUsers((prev) =>
                prev.map((user) => (user.id === userId ? data : user))
            );
        } catch (err: any) {
            alert(
                err.message || 'Не удалось добавить роль администратора'
            );
        }
    };

    const handleRemoveAdmin = async (userId: string) => {
        try {
            const data = await removeAdminRole(userId);
            setUsers((prev) =>
                prev.map((user) => (user.id === userId ? data : user))
            );
        } catch (err: any) {
            alert(
                err.message || 'Не удалось удалить роль администратора'
            );
        }
    };

    return (
        <div className="card-admin mb-4">
            <div className="card-header">
                <h3 className="mb-0">Управление пользователями</h3>
            </div>
            <div className="card-body">
                {loading && <div className="mb-3">Загрузка...</div>}
                {error && <div className="text-danger mb-3">{error}</div>}
                {!loading && users.length === 0 && (
                    <div className="text-muted">Пользователи не найдены</div>
                )}
                {users.length > 0 && (
                    <ul className="list-group">
                        {users.map((user) => (
                            <li
                                key={user.id}
                                className="list-group-item d-flex align-items-center"
                            >
                                <span className="text-truncate flex-grow-1 me-3">
                                    <a
                                        href={`/users/${user.id}`}
                                        className="fw-bold text-decoration-none"
                                        style={{
                                            display: 'inline-block',
                                            maxWidth: '100%',
                                        }}
                                    >
                                        {user.nickname}
                                    </a>
                                </span>
                                <div className="flex-shrink-0">
                                    <button
                                        className="btn btn-danger me-2"
                                        onClick={() => handleDelete(user.id)}
                                    >
                                        Удалить
                                    </button>
                                    {user.roles.includes('Admin') ? (
                                        <button
                                            className="btn btn-warning"
                                            onClick={() =>
                                                handleRemoveAdmin(user.id)
                                            }
                                        >
                                            Удалить роль администратора
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-primary"
                                            onClick={() =>
                                                handleAddAdmin(user.id)
                                            }
                                        >
                                            Добавить роль администратора
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
