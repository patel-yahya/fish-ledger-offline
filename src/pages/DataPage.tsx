import { exportAllData, getDb, saveDb } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, Database } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useRef } from 'react';

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const wb = XLSX.utils.book_new();

      const addSheet = (name: string, result: any[]) => {
        if (result.length) {
          const ws = XLSX.utils.aoa_to_sheet([result[0].columns, ...result[0].values]);
          XLSX.utils.book_append_sheet(wb, ws, name);
        }
      };

      addSheet('Fishermen', data.fishermen);
      addSheet('Species', data.species);
      addSheet('Passes', data.passes);
      addSheet('Pass Items', data.items);
      addSheet('Transactions', data.transactions);
      addSheet('Transaction Passes', data.transactionPasses);

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const date = new Date().toISOString().split('T')[0];
      saveAs(blob, `ChandFishLedger_Backup_${date}.xlsx`);
      toast.success('Backup exported!');
    } catch (e) {
      toast.error('Export failed');
      console.error(e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const db = await getDb();

      // Import Fishermen
      const fishSheet = wb.Sheets['Fishermen'];
      if (fishSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(fishSheet);
        for (const r of rows) {
          db.run('INSERT OR IGNORE INTO fishermen (name, phone, village, notes, running_balance) VALUES (?,?,?,?,?)',
            [r.name || r.Name, r.phone || '', r.village || '', r.notes || '', r.running_balance || 0]);
        }
      }

      // Import Species
      const specSheet = wb.Sheets['Species'];
      if (specSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(specSheet);
        for (const r of rows) {
          db.run('INSERT OR IGNORE INTO species (name) VALUES (?)', [r.name || r.Name]);
        }
      }

      saveDb();
      toast.success('Data imported! Refresh to see changes.');
      window.location.reload();
    } catch (err) {
      toast.error('Import failed. Check file format.');
      console.error(err);
    }
    e.target.value = '';
  };

  const handleClearAll = async () => {
    if (!confirm('⚠️ This will DELETE ALL data permanently. Are you sure?')) return;
    if (!confirm('Are you REALLY sure? This cannot be undone.')) return;
    localStorage.removeItem('chand_fish_ledger_db');
    window.location.reload();
  };

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <h1 className="text-2xl font-bold">Data Management</h1>

      <Card className="ledger-shadow border-border/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download size={18} /> Backup to Excel</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Export all data as an Excel file. Share via WhatsApp or save to your phone.</p>
          <Button onClick={handleExport} className="w-full">Download Backup (.xlsx)</Button>
        </CardContent>
      </Card>

      <Card className="ledger-shadow border-border/50">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload size={18} /> Import from Excel</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Import fishermen and species from an Excel file. Existing data will not be overwritten.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full">Select File to Import</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader><CardTitle className="text-base flex items-center gap-2 text-destructive"><Database size={18} /> Clear All Data</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Permanently delete all data. Export a backup first!</p>
          <Button variant="destructive" onClick={handleClearAll} className="w-full">Delete Everything</Button>
        </CardContent>
      </Card>
    </div>
  );
}
