import { useState } from 'react';
import { useSnapshotList } from '@/hooks/useSnapshots';
import { InrAmount } from '@/components/shared/InrAmount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { INVESTMENT_TYPE_LABELS } from '@/lib/constants';

export function SnapshotsPage() {
  const { data: snapshots = [] } = useSnapshotList();
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Snapshots</h1>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Camera className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>No snapshots yet. Use the Dashboard to calculate or generate historical snapshots.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {snapshots.map((s: any) => (
            <SnapshotRow
              key={s.year_month}
              snapshot={s}
              expanded={expandedMonth === s.year_month}
              onToggle={() => setExpandedMonth(expandedMonth === s.year_month ? null : s.year_month)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SnapshotRow({ snapshot, expanded, onToggle }: { snapshot: any; expanded: boolean; onToggle: () => void }) {
  const gainPaise = snapshot.total_value_paise - snapshot.total_invested_paise;
  const gainPercent = snapshot.total_invested_paise > 0 ? ((gainPaise) / snapshot.total_invested_paise) * 100 : 0;

  return (
    <Card>
      <CardHeader className="cursor-pointer py-3" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold">{snapshot.year_month}</span>
            <Badge variant="outline">{snapshot.total_invested_paise > 0 ? `${gainPercent.toFixed(1)}%` : '—'}</Badge>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right text-sm">
              <span className="text-muted-foreground">Invested: </span>
              <InrAmount paise={snapshot.total_invested_paise} />
            </div>
            <div className="text-right text-sm">
              <span className="text-muted-foreground">Value: </span>
              <InrAmount paise={snapshot.total_value_paise} />
            </div>
            <div className="text-right text-sm">
              <span className="text-muted-foreground">Net Worth: </span>
              <span className="font-semibold"><InrAmount paise={snapshot.net_worth_paise} /></span>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>
      {expanded && <SnapshotDetail breakdown={snapshot.breakdown_json} />}
    </Card>
  );
}

function SnapshotDetail({ breakdown }: { breakdown?: string }) {
  const bkd: Record<string, any> = breakdown ? (() => { try { return JSON.parse(breakdown); } catch { return {}; } })() : {};

  const goalData: Record<string, { name: string; value: number; target: number; progress: number }> = bkd._goals || {};
  const typeKeys = Object.keys(bkd).filter(k => k !== '_goals').sort((a, b) => {
    const la = (INVESTMENT_TYPE_LABELS as any)[a] || a;
    const lb = (INVESTMENT_TYPE_LABELS as any)[b] || b;
    return la.localeCompare(lb);
  });

  const goalEntries = Object.values(goalData);

  if (typeKeys.length === 0 && goalEntries.length === 0) {
    return <CardContent className="border-t py-4 text-sm text-muted-foreground">No data for this snapshot.</CardContent>;
  }

  return (
    <CardContent className="border-t pt-4 space-y-2">
      {typeKeys.map(type => {
        const td = bkd[type];
        return (
          <div key={type} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{(INVESTMENT_TYPE_LABELS as any)[type] || type}</span>
              {td.count != null && <Badge variant="secondary" className="text-xs">{td.count}</Badge>}
              {td.gain_percent != null && (
                <span className={`text-xs ${td.gain_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {td.gain_percent.toFixed(1)}%
                </span>
              )}
              {td.xirr != null && (
                <span className="text-xs text-muted-foreground">XIRR: {td.xirr.toFixed(1)}%</span>
              )}
            </div>
            <div className="flex gap-6 text-xs">
              <span className="text-muted-foreground">Invested: <InrAmount paise={td.invested} /></span>
              <span>Value: <InrAmount paise={td.value} /></span>
            </div>
          </div>
        );
      })}
      {goalEntries.length > 0 && (
        <div className="border-t pt-3 mt-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">Goals</p>
          <div className="space-y-1">
            {goalEntries.map((g: any) => (
              <div key={g.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{g.name}</span>
                  <span className={`text-xs ${g.progress >= 100 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {g.progress.toFixed(1)}%
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-muted-foreground">Target: <InrAmount paise={g.target} /></span>
                  <span>Value: <InrAmount paise={g.value} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </CardContent>
  );
}
