import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment } from '@/hooks/useInvestments';
import { useInvestmentTransactions, useCreateTransaction, useDeleteTransaction } from '@/hooks/useTransactions';
import { InrAmount } from '@/components/shared/InrAmount';
import { AmountInput } from '@/components/shared/AmountInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditTransactionDialog } from '@/components/shared/EditTransactionDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvestmentSummaryCard } from '@/components/shared/InvestmentSummaryCard';
import { CircleDollarSign, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { toPaise, formatINR } from '@/lib/inr';
import { toast } from 'sonner';
import type { Investment } from 'shared';

export function LoansPage() {
  const { data: investments = [] } = useInvestmentsByType('loan');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [loanType, setLoanType] = useState('home');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [emi, setEmi] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lender, setLender] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => { setName(''); setLoanType('home'); setPrincipal(''); setInterestRate(''); setEmi(''); setStartDate(''); setEndDate(''); setLender(''); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim() || !principal || !interestRate || !startDate) { toast.error('Fill required fields'); return; }
    createInvestment.mutate({
      investment: { investment_type: 'loan', name: name.trim(), notes: notes || null },
      detail: {
        principal_paise: toPaise(parseFloat(principal)), interest_rate: parseFloat(interestRate),
        emi_paise: emi ? toPaise(parseFloat(emi)) : 0, start_date: startDate,
        end_date: endDate || null, loan_type: loanType, lender: lender || null,
      },
    }, {
      onSuccess: () => { toast.success('Loan added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Loan</Button>
      </div>

      <InvestmentSummaryCard investments={investments} isLoan />

      {investments.length === 0 ? (
        <EmptyState icon={CircleDollarSign} title="No Loans" description="Add your loans to track outstanding amounts" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Loan</Button>} />
      ) : (
        <div className="grid gap-4">
          {investments.map((inv) => (
            <LoanCard key={inv.id} investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home Loan SBI" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Loan Type</Label>
                <Select value={loanType} onValueChange={setLoanType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="home">Home</SelectItem><SelectItem value="car">Car</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem><SelectItem value="education">Education</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem><SelectItem value="other">Other</SelectItem>
                </SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Lender</Label><Input value={lender} onChange={e => setLender(e.target.value)} placeholder="SBI" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Principal *</Label><AmountInput value={principal} onChange={setPrincipal} /></div>
              <div className="grid gap-2"><Label>Interest Rate (%) *</Label><Input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>EMI</Label><AmountInput value={emi} onChange={setEmi} /></div>
              <div className="grid gap-2"><Label>Start Date *</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Loan" description="This will permanently delete this loan." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
    </div>
  );
}

function LoanCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const d = investment.detail || {};
  const { data: txns = [] } = useInvestmentTransactions(expanded ? investment.id : 0);
  const createTxn = useCreateTransaction();
  const deleteTxn = useDeleteTransaction();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [txnType, setTxnType] = useState('emi');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const loanTypeLabel: Record<string, string> = { home: 'Home', car: 'Car', personal: 'Personal', education: 'Education', gold: 'Gold', other: 'Other' };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              <Badge variant="secondary">{loanTypeLabel[d.loan_type] || d.loan_type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{d.lender || ''} - EMI: {d.emi_paise ? formatINR(d.emi_paise) : '-'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-red-600">-<InrAmount paise={investment.current_value_paise || d.principal_paise || 0} /></p>
              <p className="text-xs text-muted-foreground">outstanding</p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Principal:</span> <InrAmount paise={d.principal_paise || 0} /></div>
            <div><span className="text-muted-foreground">Rate:</span> {d.interest_rate}%</div>
            <div><span className="text-muted-foreground">Start:</span> {d.start_date}</div>
            <div><span className="text-muted-foreground">End:</span> {d.end_date || '-'}</div>
            {d.start_date && d.end_date && (
              <div><span className="text-muted-foreground">Tenure:</span> {Math.round((new Date(d.end_date).getTime() - new Date(d.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))} months</div>
            )}
            <div><span className="text-muted-foreground">Outstanding:</span> <span className="text-red-600">-<InrAmount paise={investment.current_value_paise || 0} /></span></div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Payments</h4>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}><Plus className="mr-1 h-3 w-3" /> Add</Button>
            </div>
            {showAdd && (
              <div className="mt-2 grid gap-2 rounded border p-3 sm:grid-cols-4">
                <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="emi">EMI</SelectItem><SelectItem value="deposit">Prepayment</SelectItem></SelectContent></Select>
                <AmountInput value={amount} onChange={setAmount} />
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                <Button size="sm" onClick={() => { if (!amount) return; createTxn.mutate({ investmentId: investment.id, data: { txn_type: txnType, date, amount_paise: toPaise(parseFloat(amount)) } }, { onSuccess: () => { toast.success('Added'); setShowAdd(false); setAmount(''); } }); }}>Add</Button>
              </div>
            )}
            {txns.length > 0 && (
              <div className="mt-2 space-y-1">
                {txns.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2"><Badge variant="outline">{t.txn_type}</Badge><span>{t.date}</span></div>
                    <div className="flex items-center gap-2">
                      <InrAmount paise={t.amount_paise} />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditTxn(t)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteTxn.mutate(t.id, { onSuccess: () => toast.success('Deleted') })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <EditTransactionDialog transaction={editTxn} open={editTxn !== null} onOpenChange={(open) => { if (!open) setEditTxn(null); }} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
