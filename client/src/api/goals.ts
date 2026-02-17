import { api } from './client';
import type { Goal } from 'shared';

export const goalsApi = {
  getAll: () => api.get<Goal[]>('/goals'),
  getById: (id: number) => api.get<Goal>(`/goals/${id}`),
  create: (data: any) => api.post<Goal>('/goals', data),
  update: (id: number, data: any) => api.put<Goal>(`/goals/${id}`, data),
  delete: (id: number) => api.delete(`/goals/${id}`),
  assignInvestment: (goalId: number, data: any) => api.post(`/goals/${goalId}/investments`, data),
  removeInvestment: (goalId: number, investmentId: number) => api.delete(`/goals/${goalId}/investments/${investmentId}`),
  simulate: (goalId: number, data: any) => api.post<any>(`/goals/${goalId}/simulate`, data),
  getHistory: (goalId: number) => api.get<{ actual: { month: string; value: number }[]; projected: { month: string; value: number }[]; target: number }>(`/goals/${goalId}/history`),
};
