import { api } from './client';
import type { Investment } from 'shared';

export const investmentsApi = {
  getAll: () => api.get<Investment[]>('/investments'),
  getByType: (type: string) => api.get<Investment[]>(`/investments/by-type/${type}`),
  getById: (id: number) => api.get<Investment>(`/investments/${id}`),
  create: (data: { investment: any; detail: any }) => api.post<Investment>('/investments', data),
  update: (id: number, data: { investment?: any; detail?: any }) => api.put<Investment>(`/investments/${id}`, data),
  delete: (id: number) => api.delete(`/investments/${id}`),
  clearAll: () => api.post('/investments/clear-all'),
  clearByType: (type: string) => api.post(`/investments/clear-by-type/${type}`),
  addOverride: (id: number, data: any) => api.post(`/investments/${id}/override`, data),
  getOverrides: (id: number) => api.get<any[]>(`/investments/${id}/overrides`),
};
