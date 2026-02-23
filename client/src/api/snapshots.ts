import { api } from './client';

export interface SnapshotJobStatus {
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  monthsProcessed?: number;
  error?: string;
}

export const snapshotsApi = {
  calculate: (yearMonth?: string) => api.post<{ snapshots_calculated: number }>('/snapshots/calculate', { year_month: yearMonth }),
  getNetWorth: () => api.get<any[]>('/snapshots/net-worth'),
  clear: () => api.post('/snapshots/clear'),
  generateHistorical: () => api.post<{ started: boolean }>('/snapshots/generate-historical'),
  getJobStatus: () => api.get<SnapshotJobStatus | null>('/snapshots/job-status'),
  getList: () => api.get<any[]>('/snapshots/list'),
  getDetail: (yearMonth: string) => api.get<any[]>(`/snapshots/detail/${yearMonth}`),
};
