import { api } from './client';

export const snapshotsApi = {
  calculate: (yearMonth?: string) => api.post<{ snapshots_calculated: number }>('/snapshots/calculate', { year_month: yearMonth }),
  getNetWorth: () => api.get<any[]>('/snapshots/net-worth'),
  clear: () => api.post('/snapshots/clear'),
  generateHistorical: () => api.post<{ months_processed: number }>('/snapshots/generate-historical'),
  getList: () => api.get<any[]>('/snapshots/list'),
  getDetail: (yearMonth: string) => api.get<any[]>(`/snapshots/detail/${yearMonth}`),
};
