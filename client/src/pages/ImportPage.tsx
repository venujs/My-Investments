import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { INVESTMENT_TYPE_LABELS } from '@/lib/constants';

export function ImportPage() {
  const [investmentType, setInvestmentType] = useState('fd');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    setImportErrors([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('investment_type', investmentType);
      const result = await api.upload<{ created: number; transactions: number; errors: string[] }>(
        '/import/upload', formData
      );
      const parts: string[] = [];
      if (result.created > 0) parts.push(`${result.created} investment${result.created !== 1 ? 's' : ''} created`);
      if (result.transactions > 0) parts.push(`${result.transactions} transaction${result.transactions !== 1 ? 's' : ''} added`);
      if (parts.length === 0) parts.push('Nothing imported');
      if (result.errors?.length) {
        setImportErrors(result.errors);
        toast.warning(`Import complete: ${parts.join(', ')} (${result.errors.length} row${result.errors.length !== 1 ? 's' : ''} skipped)`);
      } else {
        toast.success(`Import successful: ${parts.join(', ')}`);
      }
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error(`Import failed: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const templateTypes: Record<string, string> = {
    ...INVESTMENT_TYPE_LABELS,
    transactions: 'Transactions',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import</h1>

      <Card>
        <CardHeader><CardTitle>Import from CSV</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Investment Type</Label>
            <Select value={investmentType} onValueChange={setInvestmentType}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INVESTMENT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>CSV File</Label>
            <Input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={uploading || !file}>
              <Upload className="mr-2 h-4 w-4" /> {uploading ? 'Importing...' : 'Import'}
            </Button>
            <Button variant="outline" onClick={() => window.open(`/api/export/template/${investmentType}`, '_blank')}>
              Download Template
            </Button>
          </div>
          {importErrors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-amber-700 mb-1">
                {importErrors.length} row{importErrors.length !== 1 ? 's' : ''} skipped due to errors:
              </p>
              <div className="max-h-40 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-2 space-y-1">
                {importErrors.map((err, i) => (
                  <p key={i} className="text-xs font-mono text-amber-900">{err}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Download Templates</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Download CSV templates to prepare your data for import.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(templateTypes).map(([key, label]) => (
              <Button key={key} variant="outline" onClick={() => window.open(`/api/export/template/${key}`, '_blank')} className="justify-start">
                <Download className="mr-2 h-4 w-4" /> {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
