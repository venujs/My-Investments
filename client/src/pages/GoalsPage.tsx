import { useState } from 'react';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useSimulateGoal } from '@/hooks/useGoals';
import { useInvestments } from '@/hooks/useInvestments';
import { goalsApi } from '@/api/goals';
import { InrAmount } from '@/components/shared/InrAmount';
import { AmountInput } from '@/components/shared/AmountInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Plus, Trash2, Pencil, ChevronDown, ChevronUp, TrendingUp, X, LineChart } from 'lucide-react';
import { toPaise } from '@/lib/inr';
import { toast } from 'sonner';
import { INVESTMENT_TYPE_LABELS } from '@/lib/constants';
import { useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import type { Goal } from 'shared';

export function GoalsPage() {
  const { data: goals = [] } = useGoals();
  const { data: allInvestments = [] } = useInvestments();
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();
  const simulate = useSimulateGoal();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('1');
  const [notes, setNotes] = useState('');

  // Assign investment state
  const [assignGoalId, setAssignGoalId] = useState<number | null>(null);
  const [assignInvestmentId, setAssignInvestmentId] = useState('');
  const [assignPercent, setAssignPercent] = useState('100');
  const [assignFilterType, setAssignFilterType] = useState('all');

  // Simulation state
  const [simGoalId, setSimGoalId] = useState<number | null>(null);
  const [simSip, setSimSip] = useState('');
  const [simReturn, setSimReturn] = useState('12');
  const [simResult, setSimResult] = useState<any>(null);

  const resetForm = () => { setName(''); setTargetAmount(''); setTargetDate(''); setPriority('1'); setNotes(''); };

  const handleCreate = () => {
    if (!name.trim() || !targetAmount || !targetDate) { toast.error('Fill required fields'); return; }
    createGoal.mutate({ name: name.trim(), target_amount_paise: toPaise(parseFloat(targetAmount)), target_date: targetDate, priority: parseInt(priority) || 1, notes: notes || null }, {
      onSuccess: () => { toast.success('Goal created'); setShowForm(false); resetForm(); },
      onError: () => toast.error('Failed'),
    });
  };

  // Get IDs already assigned to any goal
  const assignedInvestmentIds = new Set<number>();
  for (const goal of goals) {
    for (const gi of (goal.investments || [])) {
      assignedInvestmentIds.add(gi.investment_id);
    }
  }

  const availableInvestments = allInvestments.filter((inv: any) =>
    !assignedInvestmentIds.has(inv.id) && (assignFilterType === 'all' || inv.investment_type === assignFilterType)
  );

  const handleAssign = async () => {
    if (!assignGoalId || !assignInvestmentId) { toast.error('Select an investment'); return; }
    try {
      await goalsApi.assignInvestment(assignGoalId, { investment_id: parseInt(assignInvestmentId), allocation_percent: parseFloat(assignPercent) || 100 });
      toast.success('Investment assigned');
      qc.invalidateQueries({ queryKey: ['goals'] });
      setAssignGoalId(null);
      setAssignInvestmentId('');
      setAssignPercent('100');
    } catch {
      toast.error('Failed to assign');
    }
  };

  const handleRemoveInvestment = async (goalId: number, investmentId: number) => {
    try {
      await goalsApi.removeInvestment(goalId, investmentId);
      toast.success('Investment removed');
      qc.invalidateQueries({ queryKey: ['goals'] });
    } catch {
      toast.error('Failed to remove');
    }
  };

  const handleSimulate = () => {
    if (!simGoalId) return;
    simulate.mutate({ goalId: simGoalId, data: { monthly_sip_paise: simSip ? toPaise(parseFloat(simSip)) : 0, expected_return_percent: parseFloat(simReturn) || 12 } }, {
      onSuccess: (data) => setSimResult(data),
      onError: () => toast.error('Simulation failed'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Goals</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Goal</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No Goals" description="Set financial goals and track progress" action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Goal</Button>} />
      ) : (
        <div className="grid gap-4">
          {goals.map((goal: Goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              expanded={expandedId === goal.id}
              onToggle={() => setExpandedId(expandedId === goal.id ? null : goal.id)}
              onDelete={() => setDeleteId(goal.id)}
              onAssign={() => { setAssignGoalId(goal.id); setAssignInvestmentId(''); }}
              onSimulate={() => { setSimGoalId(goal.id); setSimResult(null); }}
              onRemoveInvestment={(invId) => handleRemoveInvestment(goal.id, invId)}
            />
          ))}
        </div>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Goal</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label>Goal Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Retirement Fund" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Target Amount *</Label><AmountInput value={targetAmount} onChange={setTargetAmount} /></div>
              <div className="grid gap-2"><Label>Target Date *</Label><Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Priority (1-10)</Label><Input type="number" min="1" max="10" value={priority} onChange={e => setPriority(e.target.value)} /></div>
              <div className="grid gap-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createGoal.isPending}>{createGoal.isPending ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Investment Dialog */}
      <Dialog open={assignGoalId !== null} onOpenChange={() => { setAssignGoalId(null); setAssignFilterType('all'); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Assign Investment to Goal</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Filter by Type</Label>
              <Select value={assignFilterType} onValueChange={(v) => { setAssignFilterType(v); setAssignInvestmentId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(INVESTMENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Investment</Label>
              <Select value={assignInvestmentId} onValueChange={setAssignInvestmentId}>
                <SelectTrigger><SelectValue placeholder="Select investment" /></SelectTrigger>
                <SelectContent>
                  {availableInvestments.map((inv: any) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.name}{inv.detail?.folio_number ? ` (${inv.detail.folio_number})` : ''} ({INVESTMENT_TYPE_LABELS[inv.investment_type] || inv.investment_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Allocation %</Label>
              <Input type="number" min="0" max="100" step="1" value={assignPercent} onChange={e => setAssignPercent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignGoalId(null)}>Cancel</Button>
            <Button onClick={handleAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulate Dialog */}
      <Dialog open={simGoalId !== null} onOpenChange={() => { setSimGoalId(null); setSimResult(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Goal Simulation</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Monthly SIP</Label>
                <AmountInput value={simSip} onChange={setSimSip} />
              </div>
              <div className="grid gap-2">
                <Label>Expected Return (%)</Label>
                <Input type="number" step="0.5" value={simReturn} onChange={e => setSimReturn(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSimulate} disabled={simulate.isPending}>
              <TrendingUp className="mr-2 h-4 w-4" /> {simulate.isPending ? 'Simulating...' : 'Simulate'}
            </Button>
            {simResult && (
              <div className="space-y-2 rounded border p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Current Value:</span><InrAmount paise={simResult.currentValue} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Projected Value:</span><InrAmount paise={simResult.projectedValue} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Target Amount:</span><InrAmount paise={simResult.targetAmount} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Months to Goal:</span><span>{simResult.monthsToGoal}</span></div>
                {simResult.shortfall > 0 && (
                  <div className="flex justify-between text-red-600"><span>Shortfall:</span><InrAmount paise={simResult.shortfall} /></div>
                )}
                <div className="flex justify-between font-medium">
                  <span>{simResult.willMeetGoal ? 'Will meet goal' : 'Will NOT meet goal'}</span>
                  <Badge variant={simResult.willMeetGoal ? 'default' : 'destructive'}>
                    {simResult.willMeetGoal ? 'On Track' : 'Behind'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSimGoalId(null); setSimResult(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)} title="Delete Goal" description="This will permanently delete this goal and unlink all investments." onConfirm={() => { if (deleteId) deleteGoal.mutate(deleteId, { onSuccess: () => { toast.success('Deleted'); setDeleteId(null); } }); }} confirmLabel="Delete" destructive />
    </div>
  );
}

function GoalCard({ goal, expanded, onToggle, onDelete, onAssign, onSimulate, onRemoveInvestment }: {
  goal: Goal; expanded: boolean; onToggle: () => void; onDelete: () => void;
  onAssign: () => void; onSimulate: () => void; onRemoveInvestment: (investmentId: number) => void;
}) {
  const updateGoal = useUpdateGoal();
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState('');
  const [editDate, setEditDate] = useState('');
  const [showTrack, setShowTrack] = useState(false);
  const [trackData, setTrackData] = useState<{ actual: { month: string; value: number }[]; projected: { month: string; value: number }[]; ideal?: { month: string; value: number }[]; target: number } | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  const handleEditOpen = () => {
    setEditTarget(String((goal.target_amount_paise / 100)));
    setEditDate(goal.target_date);
    setShowEdit(true);
  };

  const handleEditSave = () => {
    const target_amount_paise = Math.round(parseFloat(editTarget) * 100);
    if (!target_amount_paise || !editDate) { return; }
    updateGoal.mutate({ id: goal.id, data: { target_amount_paise, target_date: editDate } }, {
      onSuccess: () => { toast.success('Goal updated'); setShowEdit(false); },
      onError: () => toast.error('Failed to update'),
    });
  };

  const handleTrack = async () => {
    setTrackLoading(true);
    try {
      const data = await goalsApi.getHistory(goal.id);
      setTrackData(data);
      setShowTrack(true);
    } catch { toast.error('Failed to load tracking data'); }
    setTrackLoading(false);
  };

  // Merge actual, projected, and ideal data for chart
  const chartData = (() => {
    if (!trackData) return [];
    const map = new Map<string, { month: string; actual?: number; projected?: number; ideal?: number }>();
    for (const a of trackData.actual) {
      map.set(a.month, { month: a.month, actual: a.value / 100 });
    }
    for (const p of trackData.projected) {
      const existing = map.get(p.month);
      if (existing) {
        existing.projected = p.value / 100;
      } else {
        map.set(p.month, { month: p.month, projected: p.value / 100 });
      }
    }
    for (const i of (trackData.ideal || [])) {
      const existing = map.get(i.month);
      if (existing) {
        existing.ideal = i.value / 100;
      } else {
        map.set(i.month, { month: i.month, ideal: i.value / 100 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  })();

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{goal.name}</CardTitle>
            <p className="text-sm text-muted-foreground">by {goal.target_date} | Priority: {goal.priority}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold"><InrAmount paise={goal.current_value_paise || 0} /></p>
              <p className="text-xs text-muted-foreground">of <InrAmount paise={goal.target_amount_paise} /></p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="border-t pt-4 space-y-4">
          <Progress value={Math.min(100, goal.progress_percent || 0)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{(goal.progress_percent || 0).toFixed(1)}% achieved</span>
            <span>Target: <InrAmount paise={goal.target_amount_paise} /></span>
          </div>

          {goal.notes && <p className="text-xs text-muted-foreground">{goal.notes}</p>}

          {/* Assigned Investments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Linked Investments</h4>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onAssign(); }}>
                <Plus className="mr-1 h-3 w-3" /> Assign
              </Button>
            </div>
            {(goal.investments || []).length > 0 ? (
              <div className="space-y-1">
                {goal.investments!.map((gi) => (
                  <div key={gi.investment_id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{gi.scheme_name || gi.investment_name}{gi.folio_number ? ` (Folio: ${gi.folio_number})` : ''}</span>
                      <Badge variant="outline">{INVESTMENT_TYPE_LABELS[gi.investment_type || ''] || gi.investment_type}</Badge>
                      <span className="text-muted-foreground">{gi.allocation_percent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <InrAmount paise={gi.current_value_paise || 0} />
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); onRemoveInvestment(gi.investment_id); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No investments linked yet</p>
            )}
          </div>

          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleEditOpen(); }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSimulate(); }}>
                <TrendingUp className="mr-2 h-4 w-4" /> Simulate
              </Button>
              <Button size="sm" variant="outline" disabled={trackLoading} onClick={(e) => { e.stopPropagation(); handleTrack(); }}>
                <LineChart className="mr-2 h-4 w-4" /> {trackLoading ? 'Loading...' : 'Track'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>

          {/* Edit Goal Dialog */}
          <Dialog open={showEdit} onOpenChange={setShowEdit}>
            <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
              <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Target Amount</Label>
                  <AmountInput value={editTarget} onChange={setEditTarget} />
                </div>
                <div className="grid gap-2">
                  <Label>Target Date</Label>
                  <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button onClick={handleEditSave} disabled={updateGoal.isPending}>{updateGoal.isPending ? 'Saving...' : 'Save'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Tracking Chart */}
          {showTrack && trackData && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Goal Progress</h4>
                <Button variant="ghost" size="sm" onClick={() => setShowTrack(false)}><X className="h-3 w-3" /></Button>
              </div>
              {chartData.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(2)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
                      <Tooltip formatter={(value: number) => [`₹${value.toFixed(0)}`, '']} />
                      <ReferenceLine y={trackData.target / 100} stroke="red" strokeDasharray="5 5" label={{ value: 'Target', position: 'right', fontSize: 10 }} />
                      <Area type="monotone" dataKey="actual" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%)" fillOpacity={0.2} name="Actual" />
                      <Area type="monotone" dataKey="projected" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%)" fillOpacity={0.1} strokeDasharray="5 5" name="Projected" />
                      <Area type="monotone" dataKey="ideal" stroke="hsl(30, 80%, 55%)" fill="hsl(30, 80%, 55%)" fillOpacity={0.05} name="Ideal Path" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No history data available. Calculate snapshots first.</p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
