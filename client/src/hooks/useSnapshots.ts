import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { snapshotsApi, type SnapshotJobStatus } from '@/api/snapshots';

export function useCalculateSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (yearMonth?: string) => snapshotsApi.calculate(yearMonth),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['snapshots'] });
    },
  });
}

export function useNetWorthHistory() {
  return useQuery({ queryKey: ['snapshots', 'net-worth'], queryFn: snapshotsApi.getNetWorth });
}

export function useClearSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: snapshotsApi.clear,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['snapshots'] });
    },
  });
}

export function useGenerateHistoricalSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: snapshotsApi.generateHistorical,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['snapshots'] });
    },
  });
}

// Polls every 2s while status is 'running', stops otherwise
export function useSnapshotJobStatus() {
  return useQuery<SnapshotJobStatus | null>({
    queryKey: ['snapshots', 'job-status'],
    queryFn: snapshotsApi.getJobStatus,
    refetchInterval: (query) => query.state.data?.status === 'running' ? 2000 : false,
  });
}

export function useSnapshotList() {
  return useQuery({ queryKey: ['snapshots', 'list'], queryFn: snapshotsApi.getList });
}

export function useSnapshotDetail(yearMonth: string) {
  return useQuery({
    queryKey: ['snapshots', 'detail', yearMonth],
    queryFn: () => snapshotsApi.getDetail(yearMonth),
    enabled: !!yearMonth,
  });
}
