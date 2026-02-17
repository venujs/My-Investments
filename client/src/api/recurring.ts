import { api } from './client';
import type { InvestmentRecurringRule } from 'shared';

export const recurringApi = {
  getAll: () => api.get<InvestmentRecurringRule[]>('/recurring'),
  getById: (id: number) => api.get<InvestmentRecurringRule>(`/recurring/${id}`),
  create: (data: any) => api.post<InvestmentRecurringRule>('/recurring', data),
  update: (id: number, data: any) => api.put<InvestmentRecurringRule>(`/recurring/${id}`, data),
  delete: (id: number) => api.delete(`/recurring/${id}`),
  generate: () => api.post<{ generated: number }>('/recurring/generate'),
};
