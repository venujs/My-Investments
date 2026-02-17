import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '@/api/transactions';

export function useInvestmentTransactions(investmentId: number) {
  return useQuery({
    queryKey: ['transactions', investmentId],
    queryFn: () => transactionsApi.getByInvestment(investmentId),
    enabled: !!investmentId,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: { investmentId: number; data: any }) =>
      transactionsApi.create(investmentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}

export function useSell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investmentId, data }: { investmentId: number; data: any }) =>
      transactionsApi.sell(investmentId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}

export function useClearAllTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.clearAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => transactionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transactionsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}

export function useInvestmentLots(investmentId: number) {
  return useQuery({
    queryKey: ['lots', investmentId],
    queryFn: () => transactionsApi.getLots(investmentId),
    enabled: !!investmentId,
  });
}
