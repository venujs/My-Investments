import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStats, useNetWorthChart, useInvestmentBreakdown, useTypeHistory } from '@/hooks/useAnalytics';
import { useCalculateSnapshots, useClearSnapshots, useGenerateHistoricalSnapshots, useSnapshotJobStatus } from '@/hooks/useSnapshots';
import { useFetchMarketData } from '@/hooks/useMarket';
import { useGenerateRecurring } from '@/hooks/useRecurring';
import { useQueryClient } from '@tanstack/react-query';
import { InrAmount } from '@/components/shared/InrAmount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/inr';
import { CHART_COLORS, INVESTMENT_TYPE_LABELS } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Wallet, RefreshCw, Calculator, PieChart as PieChartIcon, Play, Trash2, Target, History, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { toast } from 'sonner';

export function DashboardPage() {
  const [selectedType, setSelectedType] = useState('mf_equity');
  const { data: stats } = useDashboardStats();
  const { data: netWorthHistory = [] } = useNetWorthChart();
  const { data: breakdown = [] } = useInvestmentBreakdown();
  const { data: typeHistory = [] } = useTypeHistory(selectedType);
  const fetchMarket = useFetchMarketData();
  const calcSnapshots = useCalculateSnapshots();
  const clearSnapshots = useClearSnapshots();
  const generateRecurring = useGenerateRecurring();
  const generateHistorical = useGenerateHistoricalSnapshots();
  const { data: jobStatus } = useSnapshotJobStatus();
  const qc = useQueryClient();

  // Track previous status to fire toast only once on transition
  const prevJobStatus = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevJobStatus.current;
    const curr = jobStatus?.status;
    if (prev === 'running' && curr === 'completed') {
      toast.success(`Historical snapshots done — ${jobStatus?.monthsProcessed} months processed`);
      qc.invalidateQueries({ queryKey: ['snapshots', 'list'] });
      qc.invalidateQueries({ queryKey: ['snapshots', 'net-worth'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    } else if (prev === 'running' && curr === 'failed') {
      toast.error(`Historical snapshots failed: ${jobStatus?.error ?? 'unknown error'}`);
    }
    prevJobStatus.current = curr;
  }, [jobStatus?.status]);

  const handleFetchMarket = () => {
    fetchMarket.mutate(undefined, {
      onSuccess: (data) => toast.success(`Fetched: ${data.mf} MF NAVs, ${data.stocks} stock prices, gold: ${data.gold ? 'yes' : 'no'}`),
      onError: () => toast.error('Failed to fetch market data'),
    });
  };

  const handleCalculateSnapshots = () => {
    calcSnapshots.mutate(undefined, {
      onSuccess: () => toast.success('Snapshots calculated'),
      onError: () => toast.error('Failed to calculate snapshots'),
    });
  };

  const handleClearSnapshots = () => {
    clearSnapshots.mutate(undefined, {
      onSuccess: () => toast.success('Snapshots cleared'),
      onError: () => toast.error('Failed to clear snapshots'),
    });
  };

  const handleGenerateRecurring = () => {
    generateRecurring.mutate(undefined, {
      onSuccess: (data: any) => toast.success(`Generated ${data.generated || 0} recurring transactions`),
      onError: () => toast.error('Failed to generate recurring transactions'),
    });
  };

  const pieData = breakdown.map((b, i) => ({
    name: b.label || INVESTMENT_TYPE_LABELS[b.investment_type] || b.investment_type,
    value: b.current_value_paise / 100,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const chartData = netWorthHistory.map((s: any) => ({
    month: s.year_month,
    'Net Worth': s.net_worth_paise / 100,
    Invested: s.total_invested_paise / 100,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerateRecurring} disabled={generateRecurring.isPending}>
            <Play className={`mr-2 h-4 w-4 ${generateRecurring.isPending ? 'animate-spin' : ''}`} />
            Generate Recurring
          </Button>
          <Button size="sm" variant="outline" onClick={handleFetchMarket} disabled={fetchMarket.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${fetchMarket.isPending ? 'animate-spin' : ''}`} />
            Fetch Prices
          </Button>
          <Button size="sm" variant="outline" onClick={handleCalculateSnapshots} disabled={calcSnapshots.isPending}>
            <Calculator className={`mr-2 h-4 w-4 ${calcSnapshots.isPending ? 'animate-spin' : ''}`} />
            Calculate Snapshots
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            generateHistorical.mutate(undefined, {
              onSuccess: () => {
                toast.success('Historical snapshot generation started in background');
                qc.invalidateQueries({ queryKey: ['snapshots', 'job-status'] });
              },
              onError: () => toast.error('Failed to generate historical snapshots'),
            });
          }} disabled={generateHistorical.isPending || jobStatus?.status === 'running'}>
            <History className={`mr-2 h-4 w-4 ${(generateHistorical.isPending || jobStatus?.status === 'running') ? 'animate-spin' : ''}`} />
            Generate Historical
          </Button>
          <Button size="sm" variant="outline" onClick={handleClearSnapshots} disabled={clearSnapshots.isPending}>
            <Trash2 className={`mr-2 h-4 w-4`} />
            Clear Snapshots
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/goals"><Target className="mr-2 h-4 w-4" /> Goals</Link>
          </Button>
        </div>
      </div>

      {/* Historical snapshot job status banner */}
      {jobStatus && (
        <div className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
          jobStatus.status === 'running'  ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200' :
          jobStatus.status === 'completed' ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200' :
          'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200'
        }`}>
          {jobStatus.status === 'running'   && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
          {jobStatus.status === 'completed' && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {jobStatus.status === 'failed'    && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="space-y-0.5">
            {jobStatus.status === 'running' && (
              <p className="font-medium">Generating historical snapshots… this runs in the background.</p>
            )}
            {jobStatus.status === 'completed' && (
              <p className="font-medium">Historical snapshots completed — {jobStatus.monthsProcessed} months processed.</p>
            )}
            {jobStatus.status === 'failed' && (
              <>
                <p className="font-medium">Historical snapshot generation failed.</p>
                <p className="font-mono text-xs break-all">{jobStatus.error}</p>
              </>
            )}
            <p className="text-xs opacity-70">
              Started {new Date(jobStatus.startedAt).toLocaleTimeString()}
              {jobStatus.completedAt && ` · Finished ${new Date(jobStatus.completedAt).toLocaleTimeString()}`}
            </p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invested</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><InrAmount paise={stats?.total_invested_paise || 0} /></div>
            <p className="text-xs text-muted-foreground">{stats?.investment_count || 0} investments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><InrAmount paise={stats?.total_current_value_paise || 0} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gain</CardTitle>
            {(stats?.total_gain_paise || 0) >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><InrAmount paise={stats?.total_gain_paise || 0} colorCode /></div>
            <p className="text-xs text-muted-foreground">
              {(stats?.total_gain_percent || 0).toFixed(1)}% return
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Worth</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary"><InrAmount paise={stats?.net_worth_paise || 0} /></div>
            {(stats?.total_debt_paise || 0) > 0 && (
              <p className="text-xs text-muted-foreground">Debt: {formatINR(stats!.total_debt_paise)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" /> Investment Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatINR(value * 100)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">No investments yet</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="truncate text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Net Worth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Net Worth History</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip formatter={(value: number) => formatINR(value * 100)} />
                  <Area type="monotone" dataKey="Net Worth" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="Invested" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Calculate snapshots to see history</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Table */}
      {breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 text-right font-medium">Count</th>
                    <th className="pb-2 text-right font-medium">Invested</th>
                    <th className="pb-2 text-right font-medium">Current Value</th>
                    <th className="pb-2 text-right font-medium">Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => (
                    <tr key={b.investment_type} className="border-b last:border-0">
                      <td className="py-2">{b.label || INVESTMENT_TYPE_LABELS[b.investment_type]}</td>
                      <td className="py-2 text-right">{b.count}</td>
                      <td className="py-2 text-right"><InrAmount paise={b.invested_paise} /></td>
                      <td className="py-2 text-right"><InrAmount paise={b.current_value_paise} /></td>
                      <td className="py-2 text-right"><InrAmount paise={b.current_value_paise - b.invested_paise} colorCode /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Type History Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Investment Type History</CardTitle>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INVESTMENT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {typeHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={typeHistory.map(h => ({ month: h.month, Invested: h.invested / 100, 'Current Value': h.value / 100 }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip formatter={(value: number) => formatINR(value * 100)} />
                <Area type="monotone" dataKey="Invested" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                <Area type="monotone" dataKey="Current Value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Calculate snapshots to see history</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
