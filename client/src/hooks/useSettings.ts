import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';

export function useTypeRates() {
  return useQuery({
    queryKey: ['settings', 'type-rates'],
    queryFn: settingsApi.getTypeRates,
  });
}

export function useUpdateTypeRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateTypeRates,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'type-rates'] });
    },
  });
}

export function usePurgeAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.purgeAllData,
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
