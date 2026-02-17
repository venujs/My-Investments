import { api } from './client';
import type { TaxSummary } from 'shared';

export const taxApi = {
  calculate: (fyStart: string, fyEnd: string) => api.post<TaxSummary>('/tax/calculate', { fy_start: fyStart, fy_end: fyEnd }),
  getGains: () => api.get<TaxSummary>('/tax/gains'),
};
