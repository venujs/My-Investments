import { api } from './client';

export const settingsApi = {
  getTypeRates: () => api.get<Record<string, number>>('/settings/type-rates'),
  updateTypeRates: (rates: Record<string, number>) => api.put<{ ok: boolean }>('/settings/type-rates', rates),
};
