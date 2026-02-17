import { api } from './client';
import type { InvestmentTransaction, InvestmentLot } from 'shared';

export const transactionsApi = {
  getByInvestment: (investmentId: number) => api.get<InvestmentTransaction[]>(`/investments/${investmentId}/transactions`),
  getAll: () => api.get<InvestmentTransaction[]>('/transactions'),
  create: (investmentId: number, data: any) => api.post<InvestmentTransaction>(`/investments/${investmentId}/transactions`, data),
  sell: (investmentId: number, data: any) => api.post<any>(`/investments/${investmentId}/sell`, data),
  getLots: (investmentId: number) => api.get<InvestmentLot[]>(`/investments/${investmentId}/lots`),
  clearAll: () => api.post('/transactions/clear-all'),
  update: (id: number, data: any) => api.put<InvestmentTransaction>(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};
