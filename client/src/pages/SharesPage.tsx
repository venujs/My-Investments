import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment, useClearInvestmentsByType } from '@/hooks/useInvestments';
import { useInvestmentTransactions, useCreateTransaction, useSell, useDeleteTransaction } from '@/hooks/useTransactions';
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
import { BarChart3, Plus, Trash2, Pencil, ChevronDown, ChevronUp, DollarSign, TrendingUp, Search, CheckSquare } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import { marketApi } from '@/api/market';
import { useQueryClient } from '@tanstack/react-query';
import type { Investment } from 'shared';

export function SharesPage() {
  const { data: investments = [] } = useInvestmentsByType('shares');
  const { data: xirrData } = useTypeXIRR('shares');
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

  const filtered = investments.filter(inv => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const d = inv.detail || {};
    return inv.name.toLowerCase().includes(q)
      || (d.ticker_symbol || '').toLowerCase().includes(q)
      || (d.company_name || '').toLowerCase().includes(q);
  });

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [exchange, setExchange] = useState('NSE');
  const [companyName, setCompanyName] = useState('');
  const [dematAccount, setDematAccount] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => { setName(''); setTicker(''); setExchange('NSE'); setCompanyName(''); setDematAccount(''); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim() || !ticker.trim()) { toast.error('Name and ticker required'); return; }
    createInvestment.mutate({
      investment: { investment_type: 'shares', name: name.trim(), notes: notes || null },
      detail: { ticker_symbol: ticker.trim().toUpperCase(), exchange, company_name: companyName || null, demat_account: dematAccount || null },
    }, {
      onSuccess: () => { toast.success('Share added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shares</h1>
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
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Share</Button>
        </div>
      </div>

      <InvestmentSummaryCard investments={investments} xirr={xirrData?.xirr} />

      {investments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or ticker..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {investments.length === 0 ? (
        <EmptyState icon={BarChart3} title="No Shares" description="Add your stock investments" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Share</Button>} />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No results for "{search}"</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2">
              {selectMode && <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />}
              <div className="flex-1 min-w-0">
                <ShareCard investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Share</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Reliance Industries" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Ticker Symbol *</Label><Input value={ticker} onChange={e => setTicker(e.target.value)} placeholder="e.g. RELIANCE" /></div>
              <div className="grid gap-2">
                <Label>Exchange</Label>
                <Select value={exchange} onValueChange={setExchange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NSE">NSE</SelectItem><SelectItem value="BSE">BSE</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Company Name</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Demat Account</Label><Input value={dematAccount} onChange={e => setDematAccount(e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Share" description="This will permanently delete this share and all transactions." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
      <ConfirmDialog open={showClearConfirm} onOpenChange={setShowClearConfirm} title="Clear All Shares" description="This will permanently delete all shares and their transactions. This cannot be undone." onConfirm={() => clearAll.mutate('shares', { onSuccess: () => { toast.success('All shares cleared'); setShowClearConfirm(false); }, onError: () => toast.error('Failed to clear') })} confirmLabel="Clear All" destructive />
      <ConfirmDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm} title={`Delete ${selectedIds.size} share(s)`} description="This will permanently delete the selected shares and their transactions." onConfirm={handleBulkDelete} confirmLabel="Delete" destructive />
    </div>
  );
}

function ShareCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const d = investment.detail || {};
  const { data: txns = [] } = useInvestmentTransactions(expanded ? investment.id : 0);
  const createTxn = useCreateTransaction();
  const sell = useSell();
  const deleteTxn = useDeleteTransaction();
  const qc = useQueryClient();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSetPrice, setShowSetPrice] = useState(false);
  const [manualPriceDate, setManualPriceDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualPrice, setManualPrice] = useState('');
  const [showChart, setShowChart] = useState(false);
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [txnType, setTxnType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [units, setUnits] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAddTxn = () => {
    if (!amount && !units) return;
    const data: any = { date, amount_paise: amount ? toPaise(parseFloat(amount)) : 0, units: units ? parseFloat(units) : null, price_per_unit_paise: price ? toPaise(parseFloat(price)) : null };
    if (txnType === 'sell') {
      sell.mutate({ investmentId: investment.id, data }, {
        onSuccess: () => { toast.success('Sell recorded'); setShowAdd(false); setAmount(''); setUnits(''); setPrice(''); },
        onError: () => toast.error('Failed'),
      });
    } else {
      createTxn.mutate({ investmentId: investment.id, data: { txn_type: txnType, ...data } }, {
        onSuccess: () => { toast.success('Added'); setShowAdd(false); setAmount(''); setUnits(''); setPrice(''); },
        onError: () => toast.error('Failed'),
      });
    }
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              <Badge variant="secondary">{d.ticker_symbol} ({d.exchange})</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{d.company_name || ''}{d.total_units != null && d.total_units > 0 ? ` · ${d.total_units} shares` : ''}{d.latest_price_paise ? ` · CMP: ₹${(d.latest_price_paise / 100).toFixed(2)}` : ''}</p>
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
            <div><span className="text-muted-foreground">Invested:</span> <InrAmount paise={investment.invested_amount_paise || 0} /></div>
            {investment.xirr != null && <div><span className="text-muted-foreground">XIRR:</span> {investment.xirr.toFixed(1)}%</div>}
            {d.latest_price_paise && <div><span className="text-muted-foreground">CMP:</span> ₹{(d.latest_price_paise / 100).toFixed(2)}</div>}
            {d.demat_account && <div><span className="text-muted-foreground">Demat:</span> {d.demat_account}</div>}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={chartLoading} onClick={async () => {
              setChartLoading(true);
              try {
                const history = await marketApi.getHistory(d.ticker_symbol, d.exchange);
                setChartData(history.map(h => ({ date: h.date, price: h.price_paise / 100 })));
                setShowChart(true);
              } catch { toast.error('Failed to fetch history'); }
              setChartLoading(false);
            }}><TrendingUp className="mr-2 h-4 w-4" /> {chartLoading ? 'Loading...' : 'Performance'}</Button>
            <Button variant="outline" size="sm" onClick={() => { setShowSetPrice(true); setManualPrice(''); setManualPriceDate(new Date().toISOString().split('T')[0]); }}><DollarSign className="mr-2 h-4 w-4" /> Set Price</Button>
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
                  <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem><SelectItem value="dividend">Dividend</SelectItem><SelectItem value="bonus">Bonus</SelectItem><SelectItem value="split">Split</SelectItem></SelectContent></Select>
                  <AmountInput value={amount} onChange={setAmount} placeholder="Amount" />
                  <Input type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="Qty" />
                  <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" />
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <Button size="sm" onClick={handleAddTxn}>Add</Button>
              </div>
            )}
            {txns.length > 0 && (
              <div className="mt-2 space-y-1">
                {txns.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t.txn_type}</Badge>
                      <span>{t.date}</span>
                      {t.units && <span className="text-muted-foreground">{t.units} @ ₹{t.price_per_unit_paise ? (t.price_per_unit_paise / 100).toFixed(2) : '-'}</span>}
                    </div>
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
          {/* Performance Chart Dialog */}
          <Dialog open={showChart} onOpenChange={setShowChart}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>{d.ticker_symbol} — Price History (1Y)</DialogTitle></DialogHeader>
              {chartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Price']} />
                      <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No price history available</p>
              )}
              <DialogFooter><Button variant="outline" onClick={() => setShowChart(false)}>Close</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          {/* Set Price Dialog */}
          <Dialog open={showSetPrice} onOpenChange={setShowSetPrice}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader><DialogTitle>Set Price — {d.ticker_symbol}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Date</Label><Input type="date" value={manualPriceDate} onChange={e => setManualPriceDate(e.target.value)} /></div>
                <div className="grid gap-2"><Label>Price per share (INR)</Label><Input type="number" step="0.01" value={manualPrice} onChange={e => setManualPrice(e.target.value)} placeholder="e.g. 1250.50" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSetPrice(false)}>Cancel</Button>
                <Button onClick={async () => {
                  if (!manualPrice || !manualPriceDate) { toast.error('Fill required fields'); return; }
                  try {
                    await marketApi.setManualPrice(d.ticker_symbol, manualPriceDate, toPaise(parseFloat(manualPrice)));
                    toast.success('Price updated');
                    qc.invalidateQueries({ queryKey: ['investments'] });
                    setShowSetPrice(false);
                  } catch { toast.error('Failed to set price'); }
                }}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      )}
    </Card>
  );
}
