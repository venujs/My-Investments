import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function useDashboardStats() {
  return useQuery({ queryKey: ['analytics', 'dashboard'], queryFn: analyticsApi.getDashboard });
}

export function useNetWorthChart() {
  return useQuery({ queryKey: ['analytics', 'net-worth-chart'], queryFn: analyticsApi.getNetWorthChart });
}

export function useInvestmentBreakdown() {
  return useQuery({ queryKey: ['analytics', 'breakdown'], queryFn: analyticsApi.getBreakdown });
}

export function useTypeXIRR(type: string) {
  return useQuery({ queryKey: ['analytics', 'type-xirr', type], queryFn: () => analyticsApi.getTypeXIRR(type), enabled: !!type });
}

export function useTypeHistory(type: string) {
  return useQuery({ queryKey: ['analytics', 'type-history', type], queryFn: () => analyticsApi.getTypeHistory(type), enabled: !!type });
}
