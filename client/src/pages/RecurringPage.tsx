import { useState } from 'react';
import { useRecurringRules, useCreateRecurringRule, useDeleteRecurringRule, useGenerateRecurring } from '@/hooks/useRecurring';
import { useInvestments } from '@/hooks/useInvestments';
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
import { Repeat, Plus, Trash2, Play } from 'lucide-react';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import { INVESTMENT_TYPE_LABELS, FREQUENCY_LABELS, TXN_TYPE_LABELS } from '@/lib/constants';

export function RecurringPage() {
  const { data: rules = [] } = useRecurringRules();
  const { data: investments = [] } = useInvestments();
  const createRule = useCreateRecurringRule();
  const deleteRule = useDeleteRecurringRule();
  const generate = useGenerateRecurring();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('all');

  const [investmentId, setInvestmentId] = useState('');
  const [txnType, setTxnType] = useState('sip');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');

  const resetForm = () => { setInvestmentId(''); setTxnType('sip'); setAmount(''); setFrequency('monthly'); setDayOfMonth('1'); setStartDate(new Date().toISOString().split('T')[0]); setEndDate(''); };

  const handleCreate = () => {
    if (!investmentId || !amount) { toast.error('Select investment and amount'); return; }
    createRule.mutate({
      investment_id: parseInt(investmentId), txn_type: txnType, amount_paise: toPaise(parseFloat(amount)),
      frequency, day_of_month: parseInt(dayOfMonth) || 1, start_date: startDate, end_date: endDate || null,
    }, {
      onSuccess: () => { toast.success('Rule created'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  const handleGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: (data: any) => toast.success(`Generated ${data.generated || 0} transactions`),
      onError: () => toast.error('Failed to generate'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring Rules</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generate.isPending}>
            <Play className="mr-2 h-4 w-4" /> {generate.isPending ? 'Generating...' : 'Generate'}
          </Button>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Rule</Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={Repeat} title="No Recurring Rules" description="Create SIP, EMI, or other recurring investment rules" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Rule</Button>} />
      ) : (() => {
        // Group rules by investment type
        const grouped: Record<string, any[]> = {};
        for (const rule of rules) {
          const type = rule.investment_type || 'other';
          if (!grouped[type]) grouped[type] = [];
          grouped[type].push(rule);
        }
        const sortedTypes = Object.keys(grouped).sort((a, b) => (INVESTMENT_TYPE_LABELS[a] || a).localeCompare(INVESTMENT_TYPE_LABELS[b] || b));
        return (
          <div className="space-y-6">
            {sortedTypes.map(type => (
              <div key={type}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">{INVESTMENT_TYPE_LABELS[type] || type}</h2>
                <div className="grid gap-2">
                  {grouped[type].map((rule: any) => (
                    <Card key={rule.id}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.scheme_name || rule.investment_name || `Investment #${rule.investment_id}`}{rule.folio_number ? ` (Folio: ${rule.folio_number})` : ''}</span>
                            <Badge variant="outline">{TXN_TYPE_LABELS[rule.txn_type] || rule.txn_type}</Badge>
                            <Badge variant="secondary">{FREQUENCY_LABELS[rule.frequency] || rule.frequency}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <InrAmount paise={rule.amount_paise} /> on day {rule.day_of_month || '-'} | {rule.start_date} to {rule.end_date || 'ongoing'}
                          </p>
                          {rule.last_generated && <p className="text-xs text-muted-foreground">Last generated: {rule.last_generated}</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Recurring Rule</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Filter by Type</Label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setInvestmentId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(INVESTMENT_TYPE_LABELS).filter(([k]) => k !== 'rd').map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Investment *</Label>
              <Select value={investmentId} onValueChange={setInvestmentId}>
                <SelectTrigger><SelectValue placeholder="Select investment" /></SelectTrigger>
                <SelectContent>
                  {investments.filter((inv: any) => inv.investment_type !== 'rd' && (filterType === 'all' || inv.investment_type === filterType)).map((inv: any) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>{inv.name}{inv.detail?.folio_number ? ` (${inv.detail.folio_number})` : ''} ({INVESTMENT_TYPE_LABELS[inv.investment_type] || inv.investment_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Transaction Type</Label>
                <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="sip">SIP</SelectItem><SelectItem value="emi">EMI</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem><SelectItem value="premium">Premium</SelectItem>
                </SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Amount *</Label><AmountInput value={amount} onChange={setAmount} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Day of Month</Label><Input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="grid gap-2"><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending}>{createRule.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Rule" description="This will delete this recurring rule." onConfirm={() => { if (deleteId) deleteRule.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
    </div>
  );
}
