import { useState, useEffect } from 'react';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { AmountInput } from './AmountInput';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toRupees, toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import { TXN_TYPE_LABELS } from '@/lib/constants';
import type { InvestmentTransaction } from 'shared';

interface EditTransactionDialogProps {
  transaction: InvestmentTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTransactionDialog({ transaction, open, onOpenChange }: EditTransactionDialogProps) {
  const updateTxn = useUpdateTransaction();
  const [txnType, setTxnType] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [units, setUnits] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (transaction) {
      setTxnType(transaction.txn_type);
      setDate(transaction.date);
      setAmount(String(toRupees(transaction.amount_paise)));
      setUnits(transaction.units != null ? String(transaction.units) : '');
      setPrice(transaction.price_per_unit_paise != null ? String(toRupees(transaction.price_per_unit_paise)) : '');
      setNotes(transaction.notes || '');
    }
  }, [transaction]);

  const handleSave = () => {
    if (!transaction) return;
    updateTxn.mutate({
      id: transaction.id,
      data: {
        txn_type: txnType,
        date,
        amount_paise: toPaise(parseFloat(amount) || 0),
        units: units ? parseFloat(units) : null,
        price_per_unit_paise: price ? toPaise(parseFloat(price)) : null,
        notes: notes || null,
      },
    }, {
      onSuccess: () => { toast.success('Transaction updated'); onOpenChange(false); },
      onError: () => toast.error('Failed to update'),
    });
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={txnType} onValueChange={setTxnType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TXN_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Amount</Label>
            <AmountInput value={amount} onChange={setAmount} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Units</Label>
              <Input type="number" step="0.001" value={units} onChange={e => setUnits(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Price per unit</Label>
              <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateTxn.isPending}>
            {updateTxn.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
