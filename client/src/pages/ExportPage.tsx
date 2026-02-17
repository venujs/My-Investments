import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { INVESTMENT_TYPE_LABELS } from '@/lib/constants';

export function ExportPage() {
  const handleExport = (type: string) => {
    window.open(`/api/export/investments?type=${type}`, '_blank');
  };

  const handleExportAll = () => {
    window.open('/api/export/investments', '_blank');
  };

  const handleExportTransactions = () => {
    window.open('/api/export/transactions', '_blank');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Export</h1>

      <Card>
        <CardHeader><CardTitle>Export to CSV</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Download your investment data as CSV files.</p>
          <div className="flex gap-2 mb-4">
            <Button onClick={handleExportAll}>
              <Download className="mr-2 h-4 w-4" /> All Investments
            </Button>
            <Button variant="secondary" onClick={handleExportTransactions}>
              <Download className="mr-2 h-4 w-4" /> All Transactions
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(INVESTMENT_TYPE_LABELS).map(([key, label]) => (
              <Button key={key} variant="outline" onClick={() => handleExport(key)} className="justify-start">
                <Download className="mr-2 h-4 w-4" /> {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
