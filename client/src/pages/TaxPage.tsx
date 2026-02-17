import { useState } from 'react';
import { useTaxGains, useCalculateTax } from '@/hooks/useTax';
import { InrAmount } from '@/components/shared/InrAmount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calculator } from 'lucide-react';
import { formatINR } from '@/lib/inr';
import { toast } from 'sonner';
import { INVESTMENT_TYPE_LABELS } from '@/lib/constants';

export function TaxPage() {
  const { data: taxData } = useTaxGains();
  const calculateTax = useCalculateTax();
  const [fyStart, setFyStart] = useState('2025-04-01');
  const [fyEnd, setFyEnd] = useState('2026-03-31');

  const handleCalculate = () => {
    calculateTax.mutate({ fyStart, fyEnd }, {
      onSuccess: () => toast.success('Tax calculated'),
      onError: () => toast.error('Failed to calculate tax'),
    });
  };

  const data = calculateTax.data || taxData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Capital Gains Tax</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Calculate for Financial Year</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label>FY Start</Label>
              <Input type="date" value={fyStart} onChange={e => setFyStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>FY End</Label>
              <Input type="date" value={fyEnd} onChange={e => setFyEnd(e.target.value)} />
            </div>
            <Button onClick={handleCalculate} disabled={calculateTax.isPending}>
              <Calculator className="mr-2 h-4 w-4" />
              {calculateTax.isPending ? 'Calculating...' : 'Calculate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Equity STCG</p>
                <p className="text-xl font-bold"><InrAmount paise={data.equity_stcg_paise} /></p>
                <p className="text-xs text-muted-foreground">Tax @ 20%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Equity LTCG</p>
                <p className="text-xl font-bold"><InrAmount paise={data.equity_ltcg_paise} /></p>
                <p className="text-xs text-muted-foreground">Tax @ 12.5% (exemption: {formatINR(data.equity_ltcg_exemption_paise)})</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Debt STCG</p>
                <p className="text-xl font-bold"><InrAmount paise={data.debt_stcg_paise} /></p>
                <p className="text-xs text-muted-foreground">At slab rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Tax</p>
                <p className="text-xl font-bold text-red-600"><InrAmount paise={data.total_tax_paise} /></p>
              </CardContent>
            </Card>
          </div>

          {data.gains && data.gains.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Capital Gains Detail</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Investment</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Sell Date</th>
                        <th className="pb-2 text-right font-medium">Sell Amount</th>
                        <th className="pb-2 text-right font-medium">Cost Basis</th>
                        <th className="pb-2 text-right font-medium">Gain</th>
                        <th className="pb-2 font-medium">Period</th>
                        <th className="pb-2 text-right font-medium">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.gains.map((g: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2">{g.investment_name}</td>
                          <td className="py-2">{INVESTMENT_TYPE_LABELS[g.investment_type] || g.investment_type}</td>
                          <td className="py-2">{g.sell_date}</td>
                          <td className="py-2 text-right"><InrAmount paise={g.sell_amount_paise} /></td>
                          <td className="py-2 text-right"><InrAmount paise={g.cost_basis_paise} /></td>
                          <td className="py-2 text-right"><InrAmount paise={g.gain_paise} colorCode /></td>
                          <td className="py-2"><Badge variant={g.is_ltcg ? 'default' : 'secondary'}>{g.is_ltcg ? 'LTCG' : 'STCG'}</Badge></td>
                          <td className="py-2 text-right"><InrAmount paise={g.tax_paise} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
