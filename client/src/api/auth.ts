import { api } from './client';
import type { User } from 'shared';

export const authApi = {
  getUsers: () => api.get<User[]>('/auth/users'),
  login: (userId: number, pin: string) => api.post<User>('/auth/login', { userId, pin }),
  logout: () => api.post<{ ok: boolean }>('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
  setup: (data: { name: string; pin: string; avatar?: string | null }) =>
    api.post<User>('/auth/setup', { ...data, is_admin: true }),
};
