import { formatINR } from '@/lib/inr';
import { cn } from '@/lib/utils';

interface InrAmountProps {
  paise: number;
  className?: string;
  colorCode?: boolean;
}

export function InrAmount({ paise, className, colorCode }: InrAmountProps) {
  return (
    <span
      className={cn(
        'tabular-nums',
        colorCode && paise > 0 && 'text-green-600',
        colorCode && paise < 0 && 'text-red-600',
        className
      )}
    >
      {formatINR(paise)}
    </span>
  );
}
