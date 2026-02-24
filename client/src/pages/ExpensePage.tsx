import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment, useUpdateInvestment } from '@/hooks/useInvestments';
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
import { Receipt, Plus, Trash2, Pencil, ChevronDown, ChevronUp, Search, Eye, EyeOff } from 'lucide-react';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import type { Investment } from 'shared';

const todayStr = new Date().toISOString().split('T')[0];

function getExpenseStatus(detail: Record<string, any>): 'planned' | 'active' | 'expired' {
  const { start_date, expense_date } = detail;
  if (!start_date || !expense_date) return 'planned';
  if (todayStr < start_date) return 'planned';
  if (todayStr > expense_date) return 'expired';
  return 'active';
}

export function ExpensePage() {
  const { data: investments = [] } = useInvestmentsByType('expense');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [hideExpired, setHideExpired] = useState(false);

  const activeCount = investments.filter(inv => getExpenseStatus(inv.detail || {}) === 'active').length;
  const expiredCount = investments.filter(inv => getExpenseStatus(inv.detail || {}) === 'expired').length;

  const filtered = investments.filter(inv => {
    const status = getExpenseStatus(inv.detail || {});
    if (hideExpired && status === 'expired') return false;
    if (!search.trim()) return true;
    return inv.name.toLowerCase().includes(search.toLowerCase());
  });

  const totalActive = investments
    .filter(inv => getExpenseStatus(inv.detail || {}) === 'active')
    .reduce((sum, inv) => sum + (inv.current_value_paise || 0), 0);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [expenseDate, setExpenseDate] = useState('');

  const resetForm = () => { setName(''); setAmount(''); setStartDate(todayStr); setExpenseDate(''); };

  const handleCreate = () => {
    if (!name.trim() || !amount || !startDate || !expenseDate) {
      toast.error('All fields are required'); return;
    }
    createInvestment.mutate({
      investment: { investment_type: 'expense', name: name.trim() },
      detail: { start_date: startDate, expense_date: expenseDate, amount_paise: toPaise(parseFloat(amount)) },
    }, {
      onSuccess: () => { toast.success('Expense added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed to add expense'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expected Expenses</h1>
        <div className="flex items-center gap-2">
          {expiredCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => setHideExpired(!hideExpired)}>
              {hideExpired ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              {hideExpired ? `Show Expired (${expiredCount})` : 'Hide Expired'}
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
        </div>
      </div>

      {investments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Expenses</p>
              <p className="text-2xl font-bold text-destructive"><InrAmount paise={totalActive} /></p>
              <p className="text-xs text-muted-foreground">{activeCount} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Planned</p>
              <p className="text-2xl font-bold">{investments.length}</p>
              <p className="text-xs text-muted-foreground">{expiredCount} expired</p>
            </CardContent>
          </Card>
        </div>
      )}

      {investments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {investments.length === 0 ? (
        <EmptyState icon={Receipt} title="No Expected Expenses" description="Track upcoming expenses that will reduce your net worth" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>} />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No results{search ? ` for "${search}"` : ''}</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map(inv => (
            <ExpenseCard
              key={inv.id}
              investment={inv}
              expanded={expandedId === inv.id}
              onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
              onDelete={() => setDeleteId(inv.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Expected Expense</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home renovation" /></div>
            <div className="grid gap-2"><Label>Amount *</Label><AmountInput value={amount} onChange={setAmount} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Start Date *</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Expected Date *</Label><Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Adding...' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Expense"
        description="This will permanently delete this expected expense."
        onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

function ExpenseCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const d = investment.detail || {};
  const status = getExpenseStatus(d);
  const updateInvestment = useUpdateInvestment();
  const [showEdit, setShowEdit] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editExpenseDate, setEditExpenseDate] = useState('');

  const statusBadge = status === 'active'
    ? <Badge className="bg-amber-100 text-amber-800 border-amber-200">Active</Badge>
    : status === 'expired'
    ? <Badge variant="secondary">Expired</Badge>
    : <Badge variant="outline">Planned</Badge>;

  const handleEdit = () => {
    setEditAmount(d.amount_paise ? String(d.amount_paise / 100) : '');
    setEditExpenseDate(d.expense_date || '');
    setShowEdit(true);
  };

  const handleSave = () => {
    const detail: Record<string, any> = {};
    if (editExpenseDate) detail.expense_date = editExpenseDate;
    if (editAmount && !isNaN(parseFloat(editAmount))) detail.amount_paise = toPaise(parseFloat(editAmount));
    updateInvestment.mutate({ id: investment.id, data: { investment: {}, detail } }, {
      onSuccess: () => { toast.success('Updated'); setShowEdit(false); },
      onError: () => toast.error('Failed to update'),
    });
  };

  return (
    <Card className={status === 'expired' ? 'opacity-60' : ''}>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground">
              {d.start_date} → {d.expense_date}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold text-destructive">-<InrAmount paise={d.amount_paise || 0} /></p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">Amount:</span> <InrAmount paise={d.amount_paise || 0} /></div>
            <div><span className="text-muted-foreground">Start:</span> {d.start_date}</div>
            <div><span className="text-muted-foreground">Expected:</span> {d.expense_date}</div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleEdit}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </div>
        </CardContent>
      )}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Amount</Label><AmountInput value={editAmount} onChange={setEditAmount} /></div>
            <div className="grid gap-2"><Label>Expected Date</Label><Input type="date" value={editExpenseDate} onChange={e => setEditExpenseDate(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateInvestment.isPending}>{updateInvestment.isPending ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
