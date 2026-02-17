import { useQuery, useMutation } from '@tanstack/react-query';
import { taxApi } from '@/api/tax';

export function useTaxGains() {
  return useQuery({ queryKey: ['tax', 'gains'], queryFn: taxApi.getGains });
}

export function useCalculateTax() {
  return useMutation({
    mutationFn: ({ fyStart, fyEnd }: { fyStart: string; fyEnd: string }) =>
      taxApi.calculate(fyStart, fyEnd),
  });
}
