import { InrAmount } from './InrAmount';
import { Card, CardContent } from '@/components/ui/card';
import type { Investment } from 'shared';

interface InvestmentSummaryCardProps {
  investments: Investment[];
  xirr?: number | null;
  isLoan?: boolean;
}

export function InvestmentSummaryCard({ investments, xirr, isLoan }: InvestmentSummaryCardProps) {
  if (investments.length === 0) return null;

  const totalCurrent = investments.reduce((sum, inv) => sum + (inv.current_value_paise || 0), 0);
  const totalInvested = investments.reduce((sum, inv) => sum + (inv.invested_amount_paise || 0), 0);
  const gainLoss = isLoan ? 0 : totalCurrent - totalInvested;
  const gainPercent = !isLoan && totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div>
            <p className="text-muted-foreground">{isLoan ? 'Total Outstanding' : 'Current Value'}</p>
            <p className="text-lg font-semibold">
              {isLoan && <span className="text-red-600">-</span>}
              <InrAmount paise={totalCurrent} className={isLoan ? 'text-red-600' : undefined} />
            </p>
          </div>
          {!isLoan && (
            <div>
              <p className="text-muted-foreground">Invested</p>
              <p className="text-lg font-semibold"><InrAmount paise={totalInvested} /></p>
            </div>
          )}
          {!isLoan && (
            <div>
              <p className="text-muted-foreground">Gain/Loss</p>
              <p className="text-lg font-semibold"><InrAmount paise={gainLoss} colorCode /></p>
            </div>
          )}
          {!isLoan && (
            <div>
              <p className="text-muted-foreground">Returns</p>
              <p className={`text-lg font-semibold ${gainPercent > 0 ? 'text-green-600' : gainPercent < 0 ? 'text-red-600' : ''}`}>
                {gainPercent.toFixed(1)}%
              </p>
            </div>
          )}
          {xirr != null && (
            <div>
              <p className="text-muted-foreground">XIRR</p>
              <p className={`text-lg font-semibold ${xirr > 0 ? 'text-green-600' : xirr < 0 ? 'text-red-600' : ''}`}>
                {xirr.toFixed(1)}%
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Count</p>
            <p className="text-lg font-semibold">{investments.length}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
