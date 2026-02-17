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
import { Landmark, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import type { Investment } from 'shared';

export function SavingsAccountsPage() {
  const { data: investments = [] } = useInvestmentsByType('savings_account');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [institution, setInstitution] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => { setName(''); setBankName(''); setAccountNumber(''); setInterestRate(''); setIfsc(''); setInstitution(''); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    createInvestment.mutate({
      investment: { investment_type: 'savings_account', name: name.trim(), institution: institution || null, notes: notes || null },
      detail: { bank_name: bankName || null, account_number: accountNumber || null, interest_rate: parseFloat(interestRate) || 0, ifsc: ifsc || null },
    }, {
      onSuccess: () => { toast.success('Savings account added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Accounts</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Account</Button>
      </div>

      <InvestmentSummaryCard investments={investments} />

      {investments.length === 0 ? (
        <EmptyState icon={Landmark} title="No Savings Accounts" description="Add your savings accounts to track balances" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Account</Button>} />
      ) : (
        <div className="grid gap-4">
          {investments.map((inv) => (
            <SavingsCard key={inv.id} investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Savings Account</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SBI Savings" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Bank Name</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Account Number</Label><Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Interest Rate (%)</Label><Input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} /></div>
              <div className="grid gap-2"><Label>IFSC</Label><Input value={ifsc} onChange={e => setIfsc(e.target.value)} /></div>
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

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Account" description="This will permanently delete this savings account." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
    </div>
  );
}

function SavingsCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
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
            <CardTitle className="text-base">{investment.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{d.bank_name} {d.account_number ? `A/c: ${d.account_number}` : ''}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold"><InrAmount paise={investment.current_value_paise || 0} /></p>
              {d.interest_rate > 0 && <p className="text-xs text-muted-foreground">{d.interest_rate}% p.a.</p>}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Bank:</span> {d.bank_name || '-'}</div>
            <div><span className="text-muted-foreground">A/c:</span> {d.account_number || '-'}</div>
            <div><span className="text-muted-foreground">IFSC:</span> {d.ifsc || '-'}</div>
            <div><span className="text-muted-foreground">Rate:</span> {d.interest_rate || 0}%</div>
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
                <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deposit">Deposit</SelectItem><SelectItem value="withdrawal">Withdrawal</SelectItem><SelectItem value="interest">Interest</SelectItem></SelectContent></Select>
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
