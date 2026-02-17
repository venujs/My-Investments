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

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('investment_type', investmentType);
      await api.upload('/import/upload', formData);
      toast.success('Import successful');
      setFile(null);
    } catch {
      toast.error('Import failed');
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
