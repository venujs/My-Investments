import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment } from '@/hooks/useInvestments';
import { useInvestmentTransactions, useCreateTransaction, useSell, useDeleteTransaction } from '@/hooks/useTransactions';
import { useGoldPrice } from '@/hooks/useMarket';
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
import { Coins, Plus, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { toPaise, formatINR } from '@/lib/inr';
import { toast } from 'sonner';
import type { Investment } from 'shared';

export function GoldPage() {
  const { data: investments = [] } = useInvestmentsByType('gold');
  const { data: xirrData } = useTypeXIRR('gold');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const { data: goldPrice } = useGoldPrice();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [form, setForm] = useState('physical');
  const [weightGrams, setWeightGrams] = useState('');
  const [purity, setPurity] = useState('24K');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => { setName(''); setForm('physical'); setWeightGrams(''); setPurity('24K'); setPurchasePrice(''); setPurchaseDate(''); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim() || !weightGrams) { toast.error('Name and weight required'); return; }
    createInvestment.mutate({
      investment: { investment_type: 'gold', name: name.trim(), notes: notes || null },
      detail: { form, weight_grams: parseFloat(weightGrams), purity, purchase_price_per_gram_paise: purchasePrice ? toPaise(parseFloat(purchasePrice)) : 0, ...(purchaseDate ? { purchase_date: purchaseDate } : {}) },
    }, {
      onSuccess: () => { toast.success('Gold added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gold</h1>
          {goldPrice && <p className="text-sm text-muted-foreground">Gold Price (24K): {formatINR(goldPrice.price_per_gram_paise)}/gram</p>}
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Gold</Button>
      </div>

      <InvestmentSummaryCard investments={investments} xirr={xirrData?.xirr} />

      {investments.length === 0 ? (
        <EmptyState icon={Coins} title="No Gold Investments" description="Track your gold holdings" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Gold</Button>} />
      ) : (
        <div className="grid gap-4">
          {investments.map((inv) => (
            <GoldCard key={inv.id} investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Gold</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gold Chain 24K" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Form</Label>
                <Select value={form} onValueChange={setForm}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="physical">Physical</SelectItem><SelectItem value="digital">Digital</SelectItem><SelectItem value="sovereign_bond">Sovereign Bond</SelectItem></SelectContent></Select>
              </div>
              <div className="grid gap-2">
                <Label>Purity</Label>
                <Select value={purity} onValueChange={setPurity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24K">24K</SelectItem><SelectItem value="22K">22K</SelectItem><SelectItem value="18K">18K</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Weight (grams) *</Label><Input type="number" step="0.01" value={weightGrams} onChange={e => setWeightGrams(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Purchase Price/gram</Label><AmountInput value={purchasePrice} onChange={setPurchasePrice} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Purchase Date</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Gold" description="This will permanently delete this gold investment." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
    </div>
  );
}

function GoldCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const d = investment.detail || {};
  const { data: txns = [] } = useInvestmentTransactions(expanded ? investment.id : 0);
  const createTxn = useCreateTransaction();
  const deleteTxn = useDeleteTransaction();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [txnType, setTxnType] = useState('buy');
  const [txnWeight, setTxnWeight] = useState('');
  const [txnPricePerGram, setTxnPricePerGram] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const formLabel = d.form === 'sovereign_bond' ? 'SGB' : d.form === 'digital' ? 'Digital' : 'Physical';

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              <Badge variant="secondary">{formLabel} {d.purity}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{d.weight_grams}g</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold"><InrAmount paise={investment.current_value_paise || 0} /></p>
              {investment.gain_paise != null && <p className="text-xs"><InrAmount paise={investment.gain_paise} colorCode /> ({(investment.gain_percent || 0).toFixed(1)}%)</p>}
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><span className="text-muted-foreground">Weight:</span> {d.weight_grams}g</div>
            <div><span className="text-muted-foreground">Purity:</span> {d.purity}</div>
            <div><span className="text-muted-foreground">Purchase Price:</span> {d.purchase_price_per_gram_paise ? formatINR(d.purchase_price_per_gram_paise) + '/g' : '-'}</div>
            <div><span className="text-muted-foreground">Purchase Date:</span> {d.purchase_date || '-'}</div>
            <div><span className="text-muted-foreground">Invested:</span> <InrAmount paise={investment.invested_amount_paise || 0} /></div>
            {investment.xirr != null && <div><span className="text-muted-foreground">XIRR:</span> {investment.xirr.toFixed(1)}%</div>}
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
              <div className="mt-2 space-y-2 rounded border p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent></Select>
                  <Input type="number" step="0.01" value={txnWeight} onChange={e => {
                    setTxnWeight(e.target.value);
                    if (e.target.value && txnPricePerGram) setAmount(String(parseFloat(e.target.value) * parseFloat(txnPricePerGram)));
                  }} placeholder="Weight (g)" />
                  <AmountInput value={txnPricePerGram} onChange={(v) => {
                    setTxnPricePerGram(v);
                    if (txnWeight && v) setAmount(String(parseFloat(txnWeight) * parseFloat(v)));
                  }} placeholder="Price/gram" />
                  <AmountInput value={amount} onChange={setAmount} placeholder="Total Amount" />
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <Button size="sm" onClick={() => {
                  if (!amount && !txnWeight) return;
                  const amountPaise = amount ? toPaise(parseFloat(amount)) : (txnWeight && txnPricePerGram ? Math.round(parseFloat(txnWeight) * toPaise(parseFloat(txnPricePerGram))) : 0);
                  if (!amountPaise) { toast.error('Enter weight + price or amount'); return; }
                  createTxn.mutate({ investmentId: investment.id, data: {
                    txn_type: txnType, date, amount_paise: amountPaise,
                    weight_grams: txnWeight ? parseFloat(txnWeight) : undefined,
                    price_per_gram_paise: txnPricePerGram ? toPaise(parseFloat(txnPricePerGram)) : undefined,
                  } }, { onSuccess: () => { toast.success('Added'); setShowAdd(false); setAmount(''); setTxnWeight(''); setTxnPricePerGram(''); } });
                }}>Add</Button>
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
