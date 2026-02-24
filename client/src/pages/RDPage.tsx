import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment, useClearInvestmentsByType } from '@/hooks/useInvestments';
import { useInvestmentTransactions } from '@/hooks/useTransactions';
import { InrAmount } from '@/components/shared/InrAmount';
import { AmountInput } from '@/components/shared/AmountInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvestmentSummaryCard } from '@/components/shared/InvestmentSummaryCard';
import { useTypeXIRR } from '@/hooks/useAnalytics';
import { RotateCcw, Plus, Trash2, ChevronDown, ChevronUp, Search, CheckSquare, EyeOff, Eye } from 'lucide-react';
import { toPaise, formatINR } from '@/lib/inr';
import { toast } from 'sonner';
import type { Investment } from 'shared';

export function RDPage() {
  const { data: investments = [] } = useInvestmentsByType('rd');
  const { data: xirrData } = useTypeXIRR('rd');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const clearAll = useClearInvestmentsByType();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [hideMatured, setHideMatured] = useState(false);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      try { await deleteInvestment.mutateAsync(id); } catch { /* continue */ }
    }
    toast.success(`${selectedIds.size} deleted`);
    setSelectedIds(new Set()); setSelectMode(false); setShowBulkDeleteConfirm(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const maturedCount = investments.filter(inv => {
    const d = inv.detail || {};
    return d.maturity_date && d.maturity_date <= todayStr;
  }).length;

  const filtered = investments.filter(inv => {
    const d = inv.detail || {};
    if (hideMatured && d.maturity_date && d.maturity_date <= todayStr) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return inv.name.toLowerCase().includes(q)
      || (d.bank_name || '').toLowerCase().includes(q);
  });

  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branch, setBranch] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [compounding, setCompounding] = useState('quarterly');
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [institution, setInstitution] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName(''); setBankName(''); setBranch(''); setMonthlyInstallment('');
    setInterestRate(''); setCompounding('quarterly'); setStartDate(''); setMaturityDate('');
    setInstitution(''); setNotes('');
  };

  const handleCreate = () => {
    if (!name.trim() || !monthlyInstallment || !interestRate || !startDate || !maturityDate) {
      toast.error('Please fill required fields'); return;
    }
    createInvestment.mutate({
      investment: { investment_type: 'rd', name: name.trim(), institution: institution || null, notes: notes || null },
      detail: {
        monthly_installment_paise: toPaise(parseFloat(monthlyInstallment)),
        interest_rate: parseFloat(interestRate),
        compounding,
        start_date: startDate,
        maturity_date: maturityDate,
        bank_name: bankName || null,
        branch: branch || null,
      },
    }, {
      onSuccess: () => { toast.success('RD created'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed to create RD'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring Deposits</h1>
        <div className="flex items-center gap-2">
          {investments.length > 0 && (
            <>
              {selectMode && selectedIds.size > 0 && (
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowBulkDeleteConfirm(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedIds.size})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>
                <CheckSquare className="mr-2 h-4 w-4" /> {selectMode ? 'Cancel' : 'Select'}
              </Button>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setShowClearConfirm(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear All
              </Button>
            </>
          )}
          {maturedCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => setHideMatured(!hideMatured)}>
              {hideMatured ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              {hideMatured ? `Show Matured (${maturedCount})` : `Hide Matured (${maturedCount})`}
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add RD</Button>
        </div>
      </div>

      <InvestmentSummaryCard investments={investments} xirr={xirrData?.xirr} />

      {investments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or bank..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {investments.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No Recurring Deposits" description="Add your first RD to start tracking" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add RD</Button>} />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No results for "{search}"</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2">
              {selectMode && <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />}
              <div className="flex-1 min-w-0">
                <RDCard investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Recurring Deposit</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SBI RD 2025" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Monthly Installment *</Label><AmountInput value={monthlyInstallment} onChange={setMonthlyInstallment} /></div>
              <div className="grid gap-2"><Label>Interest Rate (%) *</Label><Input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Compounding</Label>
              <Select value={compounding} onValueChange={setCompounding}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="half_yearly">Half Yearly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Start Date *</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Maturity Date *</Label><Input type="date" value={maturityDate} onChange={e => setMaturityDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Bank Name</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Branch</Label><Input value={branch} onChange={e => setBranch(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Institution</Label><Input value={institution} onChange={e => setInstitution(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete RD" description="This will permanently delete this RD and all its transactions." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
      <ConfirmDialog open={showClearConfirm} onOpenChange={setShowClearConfirm} title="Clear All RDs" description="This will permanently delete all recurring deposits and their transactions. This cannot be undone." onConfirm={() => clearAll.mutate('rd', { onSuccess: () => { toast.success('All RDs cleared'); setShowClearConfirm(false); }, onError: () => toast.error('Failed to clear') })} confirmLabel="Clear All" destructive />
      <ConfirmDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm} title={`Delete ${selectedIds.size} RD(s)`} description="This will permanently delete the selected RDs and their transactions." onConfirm={handleBulkDelete} confirmLabel="Delete" destructive />
    </div>
  );
}

function RDCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const d = investment.detail || {};
  const { data: txns = [] } = useInvestmentTransactions(expanded ? investment.id : 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const isMatured = d.maturity_date && d.maturity_date <= todayStr;
  const daysToMaturity = d.maturity_date
    ? Math.round((new Date(d.maturity_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className={isMatured ? 'opacity-75' : ''}>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              {isMatured
                ? <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Matured</Badge>
                : daysToMaturity !== null && daysToMaturity <= 90
                  ? <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">Matures in {daysToMaturity}d</Badge>
                  : null}
            </div>
            <p className="text-sm text-muted-foreground">{d.bank_name} - {formatINR(d.monthly_installment_paise || 0)}/month on {d.start_date ? (() => { const day = new Date(d.start_date + 'T00:00:00').getDate(); return isNaN(day) ? '?' : day; })() : '-'}th @ {d.interest_rate}%</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold"><InrAmount paise={investment.current_value_paise || 0} /></p>
              {investment.gain_paise != null && <p className="text-xs"><InrAmount paise={investment.gain_paise} colorCode /></p>}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Installment:</span> <InrAmount paise={d.monthly_installment_paise || 0} /></div>
            <div><span className="text-muted-foreground">Rate:</span> {d.interest_rate}%</div>
            <div><span className="text-muted-foreground">Start:</span> {d.start_date}</div>
            <div><span className="text-muted-foreground">Maturity Date:</span> {d.maturity_date} {isMatured && <span className="text-amber-600 text-xs">(matured)</span>}</div>
            {d.maturity_value_paise && <div><span className="text-muted-foreground">Maturity Value:</span> <InrAmount paise={d.maturity_value_paise} /></div>}
            <div><span className="text-muted-foreground">Current Value:</span> <InrAmount paise={investment.current_value_paise || 0} /></div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </div>
          {txns.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Transactions</h4>
              <div className="space-y-1">
                {txns.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2"><Badge variant="outline">{t.txn_type}</Badge><span>{t.date}</span></div>
                    <InrAmount paise={t.amount_paise} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
