import { useState } from 'react';
import { useSnapshotList, useSnapshotDetail } from '@/hooks/useSnapshots';
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
      {expanded && <SnapshotDetail yearMonth={snapshot.year_month} breakdown={snapshot.breakdown_json} />}
    </Card>
  );
}

function SnapshotDetail({ yearMonth, breakdown }: { yearMonth: string; breakdown?: string }) {
  const { data: detail = [], isLoading } = useSnapshotDetail(yearMonth);

  // Group detail by investment_type
  const grouped: Record<string, { type: string; label: string; investments: any[]; totalInvested: number; totalValue: number }> = {};
  for (const item of detail) {
    if (!grouped[item.investment_type]) {
      grouped[item.investment_type] = {
        type: item.investment_type,
        label: (INVESTMENT_TYPE_LABELS as any)[item.investment_type] || item.investment_type,
        investments: [],
        totalInvested: 0,
        totalValue: 0,
      };
    }
    grouped[item.investment_type].investments.push(item);
    grouped[item.investment_type].totalInvested += item.invested_paise;
    grouped[item.investment_type].totalValue += item.current_value_paise;
  }

  const groups = Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));

  if (isLoading) {
    return <CardContent className="border-t py-4 text-sm text-muted-foreground">Loading...</CardContent>;
  }

  if (groups.length === 0) {
    return <CardContent className="border-t py-4 text-sm text-muted-foreground">No investment data for this snapshot.</CardContent>;
  }

  return (
    <CardContent className="border-t pt-4 space-y-4">
      {groups.map((group) => (
        <div key={group.type} className="space-y-1">
          <div className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <span>{group.label}</span>
              <Badge variant="secondary" className="text-xs">{group.investments.length}</Badge>
            </div>
            <div className="flex gap-6 text-xs">
              <span className="text-muted-foreground">Invested: <InrAmount paise={group.totalInvested} /></span>
              <span>Value: <InrAmount paise={group.totalValue} /></span>
            </div>
          </div>
          <div className="ml-4 space-y-0.5">
            {group.investments.map((inv: any) => (
              <div key={inv.investment_id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{inv.investment_name}</span>
                <div className="flex gap-4">
                  <span>Invested: <InrAmount paise={inv.invested_paise} /></span>
                  <span>Value: <InrAmount paise={inv.current_value_paise} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </CardContent>
  );
}
