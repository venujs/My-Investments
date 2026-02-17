import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '@/api/goals';

export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: goalsApi.getAll });
}

export function useGoal(id: number) {
  return useQuery({ queryKey: ['goals', id], queryFn: () => goalsApi.getById(id), enabled: !!id });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => goalsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); },
  });
}

export function useSimulateGoal() {
  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: number; data: any }) => goalsApi.simulate(goalId, data),
  });
}
