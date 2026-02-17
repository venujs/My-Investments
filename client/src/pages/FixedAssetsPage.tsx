import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment } from '@/hooks/useInvestments';
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
import { Home, Plus, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import { investmentsApi } from '@/api/investments';
import { useQueryClient } from '@tanstack/react-query';
import type { Investment } from 'shared';

export function FixedAssetsPage() {
  const { data: investments = [] } = useInvestmentsByType('fixed_asset');
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [overrideInv, setOverrideInv] = useState<Investment | null>(null);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('property');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [inflationRate, setInflationRate] = useState('6');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => { setName(''); setCategory('property'); setPurchaseDate(''); setPurchasePrice(''); setInflationRate('6'); setDescription(''); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim() || !purchaseDate || !purchasePrice) { toast.error('Fill required fields'); return; }
    createInvestment.mutate({
      investment: { investment_type: 'fixed_asset', name: name.trim(), notes: notes || null },
      detail: { category, purchase_date: purchaseDate, purchase_price_paise: toPaise(parseFloat(purchasePrice)), inflation_rate: parseFloat(inflationRate) || 6, description: description || null },
    }, {
      onSuccess: () => { toast.success('Asset added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  const categoryLabels: Record<string, string> = { property: 'Property', vehicle: 'Vehicle', jewelry: 'Jewelry', art: 'Art', other: 'Other' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fixed Assets</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Asset</Button>
      </div>

      <InvestmentSummaryCard investments={investments} />

      {investments.length === 0 ? (
        <EmptyState icon={Home} title="No Fixed Assets" description="Add properties, vehicles, and other assets" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Asset</Button>} />
      ) : (
        <div className="grid gap-4">
          {investments.map((inv) => {
            const d = inv.detail || {};
            return (
              <Card key={inv.id}>
                <CardHeader className="cursor-pointer" onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{inv.name}</CardTitle>
                        <Badge variant="secondary">{categoryLabels[d.category] || d.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{d.description || ''}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold"><InrAmount paise={inv.current_value_paise || d.purchase_price_paise || 0} /></p>
                        {inv.gain_paise != null && <p className="text-xs"><InrAmount paise={inv.gain_paise} colorCode /></p>}
                      </div>
                      {expandedId === inv.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </CardHeader>
                {expandedId === inv.id && (
                  <CardContent className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div><span className="text-muted-foreground">Purchase:</span> <InrAmount paise={d.purchase_price_paise || 0} /></div>
                      <div><span className="text-muted-foreground">Date:</span> {d.purchase_date}</div>
                      <div><span className="text-muted-foreground">Appreciation:</span> {d.inflation_rate}% p.a.</div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setOverrideInv(inv); setOverrideDate(new Date().toISOString().slice(0, 10)); setOverrideValue(''); setOverrideReason(''); }}><Pencil className="mr-2 h-4 w-4" /> Set Value</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(inv.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Fixed Asset</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Flat in Pune" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="property">Property</SelectItem><SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="jewelry">Jewelry</SelectItem><SelectItem value="art">Art</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Purchase Date *</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Purchase Price *</Label><AmountInput value={purchasePrice} onChange={setPurchasePrice} /></div>
              <div className="grid gap-2"><Label>Appreciation Rate (%)</Label><Input type="number" step="0.1" value={inflationRate} onChange={e => setInflationRate(e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Asset" description="This will permanently delete this asset." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />

      {/* Override Value Dialog */}
      <Dialog open={overrideInv !== null} onOpenChange={() => setOverrideInv(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Set Current Value — {overrideInv?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Date</Label><Input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Current Value</Label><AmountInput value={overrideValue} onChange={setOverrideValue} /></div>
            <div className="grid gap-2"><Label>Reason (optional)</Label><Input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Market valuation" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideInv(null)}>Cancel</Button>
            <Button onClick={async () => {
              if (!overrideInv || !overrideDate || !overrideValue) { toast.error('Fill required fields'); return; }
              try {
                await investmentsApi.addOverride(overrideInv.id, { override_date: overrideDate, value_paise: toPaise(parseFloat(overrideValue)), reason: overrideReason || null });
                toast.success('Value updated');
                qc.invalidateQueries({ queryKey: ['investments'] });
                setOverrideInv(null);
              } catch { toast.error('Failed to set value'); }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
