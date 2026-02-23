import { useState } from 'react';
import { useInvestmentsByType, useCreateInvestment, useDeleteInvestment, useUpdateInvestment, useClearInvestmentsByType } from '@/hooks/useInvestments';
import { useInvestmentTransactions, useCreateTransaction, useSell, useDeleteTransaction } from '@/hooks/useTransactions';
import { useSearchMF } from '@/hooks/useMarket';
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
import { TrendingUp, Plus, Trash2, Pencil, ChevronDown, ChevronUp, Search, RefreshCw, CheckSquare } from 'lucide-react';
import { toPaise, formatINR } from '@/lib/inr';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { marketApi } from '@/api/market';
import type { Investment } from 'shared';

export function MutualFundsPage() {
  const { data: equityFunds = [] } = useInvestmentsByType('mf_equity');
  const { data: hybridFunds = [] } = useInvestmentsByType('mf_hybrid');
  const { data: debtFunds = [] } = useInvestmentsByType('mf_debt');
  const investments = [...equityFunds, ...hybridFunds, ...debtFunds];
  const { data: xirrEquity } = useTypeXIRR('mf_equity');
  const { data: xirrHybrid } = useTypeXIRR('mf_hybrid');
  const { data: xirrDebt } = useTypeXIRR('mf_debt');
  // Compute combined XIRR as weighted average or just show individual ones — for simplicity, we don't combine
  const createInvestment = useCreateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const clearAll = useClearInvestmentsByType();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [listSearch, setListSearch] = useState('');
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
    if (!listSearch.trim()) return true;
    const q = listSearch.toLowerCase();
    const d = inv.detail || {};
    return inv.name.toLowerCase().includes(q)
      || (d.scheme_name || '').toLowerCase().includes(q)
      || (d.amc || '').toLowerCase().includes(q)
      || (d.isin_code || '').toLowerCase().includes(q);
  });

  // Form
  const [name, setName] = useState('');
  const [mfType, setMfType] = useState<string>('mf_equity');
  const [searchQuery, setSearchQuery] = useState('');
  const [isinCode, setIsinCode] = useState('');
  const [schemeCode, setSchemeCode] = useState('');
  const [schemeName, setSchemeName] = useState('');
  const [folioNumber, setFolioNumber] = useState('');
  const [amc, setAmc] = useState('');
  const [notes, setNotes] = useState('');

  const { data: searchResults = [] } = useSearchMF(searchQuery);

  const resetForm = () => { setName(''); setMfType('mf_equity'); setSearchQuery(''); setIsinCode(''); setSchemeCode(''); setSchemeName(''); setFolioNumber(''); setAmc(''); setNotes(''); };

  const handleSelectScheme = async (scheme: { schemeCode: string; schemeName: string }) => {
    setSchemeName(scheme.schemeName);
    setSchemeCode(scheme.schemeCode);
    if (!name) setName(scheme.schemeName);
    setSearchQuery('');
    try {
      const details = await marketApi.getSchemeDetails(scheme.schemeCode);
      setIsinCode(details.isin || scheme.schemeCode);
    } catch {
      setIsinCode(scheme.schemeCode); // fallback to scheme code if ISIN unavailable
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !isinCode) { toast.error('Name and ISIN code required'); return; }
    createInvestment.mutate({
      investment: { investment_type: mfType, name: name.trim(), notes: notes || null },
      detail: { isin_code: isinCode, scheme_code: schemeCode || null, scheme_name: schemeName || null, folio_number: folioNumber || null, amc: amc || null },
    }, {
      onSuccess: () => { toast.success('Mutual fund added'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mutual Funds</h1>
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
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Fund</Button>
        </div>
      </div>

      <InvestmentSummaryCard investments={investments} xirr={xirrEquity?.xirr ?? xirrHybrid?.xirr ?? xirrDebt?.xirr} />

      {investments.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, scheme or AMC..." value={listSearch} onChange={e => setListSearch(e.target.value)} />
        </div>
      )}

      {investments.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No Mutual Funds" description="Add your mutual fund investments" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Fund</Button>} />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No results for "{listSearch}"</p>
      ) : (
        <div className="grid gap-4">
          {filtered.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2">
              {selectMode && <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />}
              <div className="flex-1 min-w-0">
                <MFCard investment={inv} expanded={expandedId === inv.id} onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)} onDelete={() => setDeleteId(inv.id)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Add Mutual Fund</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Fund Type</Label>
              <Select value={mfType} onValueChange={setMfType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mf_equity">Equity</SelectItem>
                  <SelectItem value="mf_hybrid">Hybrid</SelectItem>
                  <SelectItem value="mf_debt">Debt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Search Scheme</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Type scheme name (min 3 chars)" />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border">
                  {searchResults.slice(0, 10).map((s) => (
                    <button key={s.schemeCode} className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => handleSelectScheme(s)}>
                      {s.schemeName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2"><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>ISIN Code *</Label><Input value={isinCode} onChange={e => setIsinCode(e.target.value)} placeholder="e.g. INF179K01VC6" /></div>
              <div className="grid gap-2"><Label>AMFI Code</Label><Input value={schemeCode} onChange={e => setSchemeCode(e.target.value)} placeholder="e.g. 120503 (auto-filled by search)" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Folio Number</Label><Input value={folioNumber} onChange={e => setFolioNumber(e.target.value)} /></div>
              <div className="grid gap-2"><Label>AMC</Label><Input value={amc} onChange={e => setAmc(e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createInvestment.isPending}>{createInvestment.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Fund" description="This will permanently delete this mutual fund and all transactions." onConfirm={() => { if (deleteId) deleteInvestment.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
      <ConfirmDialog open={showClearConfirm} onOpenChange={setShowClearConfirm} title="Clear All Mutual Funds" description="This will permanently delete all mutual funds (equity, hybrid, debt) and their transactions. This cannot be undone." onConfirm={() => clearAll.mutate('mf', { onSuccess: () => { toast.success('All mutual funds cleared'); setShowClearConfirm(false); }, onError: () => toast.error('Failed to clear') })} confirmLabel="Clear All" destructive />
      <ConfirmDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm} title={`Delete ${selectedIds.size} fund(s)`} description="This will permanently delete the selected mutual funds and their transactions." onConfirm={handleBulkDelete} confirmLabel="Delete" destructive />
    </div>
  );
}

function MFCard({ investment, expanded, onToggle, onDelete }: { investment: Investment; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const d = investment.detail || {};
  const { data: txns = [] } = useInvestmentTransactions(expanded ? investment.id : 0);
  const createTxn = useCreateTransaction();
  const sell = useSell();
  const deleteTxn = useDeleteTransaction();
  const updateInvestment = useUpdateInvestment();
  const [editTxn, setEditTxn] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFolio, setEditFolio] = useState('');
  const [txnType, setTxnType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [units, setUnits] = useState('');
  const [nav, setNav] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [fetchingNav, setFetchingNav] = useState(false);
  const qc = useQueryClient();

  const handleAddTxn = () => {
    if (!amount) return;
    if (txnType === 'sell') {
      sell.mutate({ investmentId: investment.id, data: { date, units: parseFloat(units), price_per_unit_paise: toPaise(parseFloat(nav)), amount_paise: toPaise(parseFloat(amount)) } }, {
        onSuccess: () => { toast.success('Sell recorded'); setShowAdd(false); setAmount(''); setUnits(''); setNav(''); },
        onError: () => toast.error('Failed'),
      });
    } else {
      createTxn.mutate({ investmentId: investment.id, data: { txn_type: txnType, date, amount_paise: toPaise(parseFloat(amount)), units: units ? parseFloat(units) : null, price_per_unit_paise: nav ? toPaise(parseFloat(nav)) : null } }, {
        onSuccess: () => { toast.success('Added'); setShowAdd(false); setAmount(''); setUnits(''); setNav(''); },
        onError: () => toast.error('Failed'),
      });
    }
  };

  const typeLabel = investment.investment_type === 'mf_equity' ? 'Equity' : investment.investment_type === 'mf_hybrid' ? 'Hybrid' : 'Debt';

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{investment.name}</CardTitle>
              <Badge variant="secondary">{typeLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{d.amc || ''} {d.folio_number ? `Folio: ${d.folio_number}` : ''}</p>
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
            <div><span className="text-muted-foreground">ISIN:</span> {d.isin_code}</div>
            {d.scheme_code && <div><span className="text-muted-foreground">AMFI:</span> {d.scheme_code}</div>}
            <div><span className="text-muted-foreground">Invested:</span> <InrAmount paise={investment.invested_amount_paise || 0} /></div>
            {investment.xirr != null && <div><span className="text-muted-foreground">XIRR:</span> {investment.xirr.toFixed(1)}%</div>}
            {d.total_units > 0 && <div><span className="text-muted-foreground">Units:</span> {d.total_units.toFixed(3)}</div>}
            {d.latest_nav_paise && <div><span className="text-muted-foreground">NAV:</span> {formatINR(d.latest_nav_paise)}</div>}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {(d.scheme_code || d.isin_code) && (
              <Button variant="outline" size="sm" disabled={fetchingNav} onClick={async () => {
                setFetchingNav(true);
                try {
                  const result = await marketApi.fetchMFNav(d.scheme_code || d.isin_code);
                  toast.success(`NAV fetched: ₹${result.nav}`);
                  qc.invalidateQueries({ queryKey: ['investments'] });
                } catch { toast.error('Failed to fetch NAV'); }
                setFetchingNav(false);
              }}>
                <RefreshCw className={`mr-2 h-4 w-4 ${fetchingNav ? 'animate-spin' : ''}`} /> Fetch NAV
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setEditName(investment.name); setEditFolio(d.folio_number || ''); setShowEdit(true); }}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </div>
          {/* Edit MF Dialog */}
          <Dialog open={showEdit} onOpenChange={setShowEdit}>
            <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
              <DialogHeader><DialogTitle>Edit Mutual Fund</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                <div className="grid gap-2"><Label>Folio Number</Label><Input value={editFolio} onChange={e => setEditFolio(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button onClick={() => {
                  updateInvestment.mutate({ id: investment.id, data: { investment: { name: editName }, detail: { folio_number: editFolio || null } } }, {
                    onSuccess: () => { toast.success('Updated'); setShowEdit(false); },
                    onError: () => toast.error('Failed to update'),
                  });
                }} disabled={updateInvestment.isPending}>{updateInvestment.isPending ? 'Saving...' : 'Save'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Transactions</h4>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}><Plus className="mr-1 h-3 w-3" /> Add</Button>
            </div>
            {showAdd && (
              <div className="mt-2 space-y-2 rounded border p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Select value={txnType} onValueChange={setTxnType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="buy">Buy/SIP</SelectItem><SelectItem value="sell">Sell</SelectItem><SelectItem value="dividend">Dividend</SelectItem></SelectContent></Select>
                  <AmountInput value={amount} onChange={setAmount} placeholder="Amount" />
                  <Input type="number" step="0.001" value={units} onChange={e => setUnits(e.target.value)} placeholder="Units" />
                  <Input type="number" step="0.01" value={nav} onChange={e => setNav(e.target.value)} placeholder="NAV" />
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
                      {t.units && <span className="text-muted-foreground">{t.units} units</span>}
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
        </CardContent>
      )}
    </Card>
  );
}
