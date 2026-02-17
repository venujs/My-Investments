import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCalculateSnapshots, useClearSnapshots } from '@/hooks/useSnapshots';
import { useFetchMarketData } from '@/hooks/useMarket';
import { useClearAllInvestments } from '@/hooks/useInvestments';
import { useClearAllTransactions } from '@/hooks/useTransactions';
import { useTypeRates, useUpdateTypeRates } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Settings, RefreshCw, Calculator, Trash2, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';

const RATE_LABELS: Record<string, string> = {
  rate_fd: 'Fixed Deposits',
  rate_rd: 'Recurring Deposits',
  rate_mf_equity: 'MF - Equity',
  rate_mf_hybrid: 'MF - Hybrid',
  rate_mf_debt: 'MF - Debt',
  rate_shares: 'Shares',
  rate_gold: 'Gold',
  rate_loan: 'Loans',
  rate_fixed_asset: 'Fixed Assets',
  rate_pension: 'Pension',
  rate_savings_account: 'Savings Account',
};

export function SettingsPage() {
  const { user } = useAuth();
  const fetchMarket = useFetchMarketData();
  const calcSnapshots = useCalculateSnapshots();
  const clearSnapshots = useClearSnapshots();
  const clearAllInvestments = useClearAllInvestments();
  const clearAllTransactions = useClearAllTransactions();
  const { data: typeRates } = useTypeRates();
  const updateTypeRates = useUpdateTypeRates();
  const [rates, setRates] = useState<Record<string, number>>({});
  const [showClear, setShowClear] = useState(false);
  const [showClearTxns, setShowClearTxns] = useState(false);
  const [showClearInv, setShowClearInv] = useState(false);

  useEffect(() => {
    if (typeRates) setRates(typeRates);
  }, [typeRates]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {user?.name}</div>
            <div><span className="text-muted-foreground">Admin:</span> {user?.is_admin ? 'Yes' : 'No'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Market data and snapshot operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start" onClick={() => fetchMarket.mutate(undefined, { onSuccess: () => toast.success('Market data fetched'), onError: () => toast.error('Failed') })} disabled={fetchMarket.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${fetchMarket.isPending ? 'animate-spin' : ''}`} /> Fetch Market Data
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => calcSnapshots.mutate(undefined, { onSuccess: () => toast.success('Snapshots calculated'), onError: () => toast.error('Failed') })} disabled={calcSnapshots.isPending}>
            <Calculator className={`mr-2 h-4 w-4 ${calcSnapshots.isPending ? 'animate-spin' : ''}`} /> Calculate Snapshots
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => setShowClear(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear All Snapshots
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Appreciation Rates</CardTitle>
          <CardDescription>Annual rates used for goal projections (% per year)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(RATE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Label htmlFor={key} className="min-w-[120px] text-sm">{label}</Label>
                <div className="relative flex-1">
                  <Input
                    id={key}
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={rates[key] ?? ''}
                    onChange={(e) => setRates(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={() => updateTypeRates.mutate(rates, { onSuccess: () => toast.success('Rates saved'), onError: () => toast.error('Failed to save rates') })}
            disabled={updateTypeRates.isPending}
          >
            <Save className="mr-2 h-4 w-4" /> Save Rates
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Danger Zone</CardTitle>
          <CardDescription>Destructive actions that cannot be undone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => setShowClearTxns(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear All Transactions
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={() => setShowClearInv(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete All Investments
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog open={showClear} onOpenChange={setShowClear} title="Clear Snapshots" description="This will delete all monthly snapshots and net worth history. This cannot be undone." onConfirm={() => { clearSnapshots.mutate(undefined, { onSuccess: () => { toast.success('Snapshots cleared'); setShowClear(false); }, onError: () => toast.error('Failed') }); }} confirmLabel="Clear All" destructive />

      <ConfirmDialog open={showClearTxns} onOpenChange={setShowClearTxns} title="Clear All Transactions" description="This will permanently delete ALL transactions, lots, and sell allocations. This cannot be undone." onConfirm={() => { clearAllTransactions.mutate(undefined, { onSuccess: () => { toast.success('All transactions cleared'); setShowClearTxns(false); }, onError: () => toast.error('Failed') }); }} confirmLabel="Clear All Transactions" destructive />

      <ConfirmDialog open={showClearInv} onOpenChange={setShowClearInv} title="Delete All Investments" description="This will permanently delete ALL investments and their associated data (transactions, overrides, etc). This cannot be undone." onConfirm={() => { clearAllInvestments.mutate(undefined, { onSuccess: () => { toast.success('All investments deleted'); setShowClearInv(false); }, onError: () => toast.error('Failed') }); }} confirmLabel="Delete All Investments" destructive />
    </div>
  );
}
