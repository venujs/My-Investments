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
import { useTypeXIRR } from '@/hooks/useAnalytics';
import { PiggyBank, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import type { Investment } from 'shared';

export function PensionPage() {
  const { data: investments = [] } = useInvestmentsByType('pension');
  const { data: xirrData } = useTypeXIRR('pension');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [pensionType, setPensionType] = useState('epf');
  const [interestRate, setInterestRate] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => { setName(''); setPensionType('epf'); setInterestRate(''); setAccountNumber(''); setInstitution(''); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    createInvestment.mutate({
      investment: { investment_type: 'pension', name: name.trim(), institution: institution || null, notes: notes || null },
      detail: { pension_type: pensionType, interest_rate: parseFloat(interestRate) || 0, account_number: accountNumber || null },
    }, {
      onSuccess: () => { toast.success('Pension added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  const typeLabels: Record<string, string> = { nps: 'NPS', epf: 'EPF', ppf: 'PPF', gratuity: 'Gratuity', other: 'Other' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pension</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Pension</Button>
      </div>

      <InvestmentSummaryCard investments={investments} xirr={xirrData?.xirr} />

      {investments.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No Pension Accounts" description="Track your EPF, PPF, NPS, and other pension funds" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Pension</Button>} />
      ) : (
        <div className="grid gap-4">
          {investments.map((inv) => (
            <PensionCard key={inv.id} investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} typeLabels={typeLabels} />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Pension</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. EPF Account" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Pension Type</Label>
                <Select value={pensionType} onValueChange={setPensionType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="nps">NPS</SelectItem><SelectItem value="epf">EPF</SelectItem>
                  <SelectItem value="ppf">PPF</SelectItem><SelectItem value="gratuity">Gratuity</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Interest Rate (%)</Label><Input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Account Number</Label><Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Institution</Label><Input value={institution} onChange={e => setInstitution(e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Pension" description="This will permanently delete this pension account." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
    </div>
  );
}

function PensionCard({ investment, expanded, onToggle, onDelete, typeLabels }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void; typeLabels: Record<string, string> }) {
  const d = investment.detail || {};
  const { data: txns = [] } = useInvestmentTransactions(expanded ? investment.id : 0);
  const createTxn = useCreateTransaction();
  const deleteTxn = useDeleteTransaction();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [txnType, setTxnType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              <Badge variant="secondary">{typeLabels[d.pension_type] || d.pension_type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{d.account_number ? `A/c: ${d.account_number}` : ''} {d.interest_rate ? `@ ${d.interest_rate}%` : ''}</p>
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
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">Type:</span> {typeLabels[d.pension_type] || d.pension_type}</div>
            <div><span className="text-muted-foreground">Rate:</span> {d.interest_rate || 0}%</div>
            <div><span className="text-muted-foreground">Invested:</span> <InrAmount paise={investment.invested_amount_paise || 0} /></div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Transactions</h4>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}><Plus className="mr-1 h-3 w-3" /> Add</Button>
            </div>
            {showAdd && (
              <div className="mt-2 grid gap-2 rounded border p-3 sm:grid-cols-4">
                <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deposit">Deposit</SelectItem><SelectItem value="interest">Interest</SelectItem><SelectItem value="withdrawal">Withdrawal</SelectItem></SelectContent></Select>
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
