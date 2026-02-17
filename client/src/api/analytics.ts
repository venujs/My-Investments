import { api } from './client';
import type { DashboardStats, InvestmentBreakdown } from 'shared';

export const analyticsApi = {
  getDashboard: () => api.get<DashboardStats>('/analytics/dashboard'),
  getNetWorthChart: () => api.get<any[]>('/analytics/net-worth-chart'),
  getBreakdown: () => api.get<InvestmentBreakdown[]>('/analytics/breakdown'),
  getTypeXIRR: (type: string) => api.get<{ xirr: number | null }>(`/analytics/type-xirr/${type}`),
  getTypeHistory: (type: string) => api.get<{ month: string; invested: number; value: number }[]>(`/analytics/type-history/${type}`),
};
