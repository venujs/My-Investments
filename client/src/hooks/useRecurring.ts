import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '@/api/recurring';

export function useRecurringRules() {
  return useQuery({ queryKey: ['recurring'], queryFn: recurringApi.getAll });
}

export function useCreateRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recurringApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring'] }); },
  });
}

export function useUpdateRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => recurringApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring'] }); },
  });
}

export function useDeleteRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recurringApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring'] }); },
  });
}

export function useGenerateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recurringApi.generate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['investments'] });
    },
  });
}
