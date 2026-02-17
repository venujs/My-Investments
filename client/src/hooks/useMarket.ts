import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketApi } from '@/api/market';

export function useFetchMarketData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: marketApi.fetch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); },
  });
}

export function useMarketPrice(symbol: string, source?: string) {
  return useQuery({
    queryKey: ['market', 'price', symbol, source],
    queryFn: () => marketApi.getPrice(symbol, source),
    enabled: !!symbol,
  });
}

export function useGoldPrice() {
  return useQuery({ queryKey: ['market', 'gold'], queryFn: marketApi.getGoldPrice });
}

export function useSearchMF(query: string) {
  return useQuery({
    queryKey: ['market', 'mf', 'search', query],
    queryFn: () => marketApi.searchMF(query),
    enabled: query.length >= 3,
  });
}
