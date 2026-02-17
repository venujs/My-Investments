import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { investmentsApi } from '@/api/investments';

export function useInvestments() {
  return useQuery({ queryKey: ['investments'], queryFn: investmentsApi.getAll });
}

export function useInvestmentsByType(type: string) {
  return useQuery({ queryKey: ['investments', 'type', type], queryFn: () => investmentsApi.getByType(type) });
}

export function useInvestment(id: number) {
  return useQuery({ queryKey: ['investments', id], queryFn: () => investmentsApi.getById(id), enabled: !!id });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: investmentsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); },
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => investmentsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); },
  });
}

export function useClearAllInvestments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: investmentsApi.clearAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: investmentsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investments'] }); },
  });
}
