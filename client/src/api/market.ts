import { api } from './client';

export const marketApi = {
  fetch: () => api.post<{ mf: number; stocks: number; gold: boolean }>('/market/fetch'),
  getPrice: (symbol: string, source?: string) => api.get<any>(`/market/price/${symbol}${source ? `?source=${source}` : ''}`),
  getGoldPrice: () => api.get<any>('/market/gold'),
  searchMF: (query: string) => api.get<{ schemeCode: string; schemeName: string }[]>(`/market/mf/search?q=${encodeURIComponent(query)}`),
  setManualPrice: (symbol: string, date: string, price_paise: number) => api.post('/market/price', { symbol, date, price_paise }),
  getHistory: (symbol: string, exchange?: string) => api.get<{ date: string; price_paise: number }[]>(`/market/history/${symbol}${exchange ? `?exchange=${exchange}` : ''}`),
  fetchMFNav: (isinCode: string) => api.post<{ date: string; nav: number; price_paise: number }>(`/market/fetch-mf/${isinCode}`),
  getSchemeDetails: (schemeCode: string) => api.get<{ isin: string; isin_reinvestment: string | null; scheme_name: string | null }>(`/market/mf/scheme/${schemeCode}`),
};
