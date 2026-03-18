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

      // Helper to find a value case-insensitively
      const val = (r: any, ...keys: string[]) => {
        for (const k of keys) {
          if (r[k] !== undefined) return r[k];
          const lk = k.toLowerCase();
          const found = Object.keys(r).find(rk => rk.toLowerCase() === lk);
          if (found && r[found] !== undefined) return r[found];
        }
        return '';
      };

      // 1. Import Fishermen - build name→id map
      const fishMap = new Map<string, number>();
      const fishSheet = wb.Sheets['Fishermen'];
      if (fishSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(fishSheet);
        for (const r of rows) {
          const name = val(r, 'name', 'Name');
          if (!name) continue;
          db.run('INSERT OR IGNORE INTO fishermen (name, phone, village, notes, running_balance) VALUES (?,?,?,?,?)',
            [name, val(r, 'phone') || '', val(r, 'village') || '', val(r, 'notes') || '', Number(val(r, 'running_balance')) || 0]);
        }
      }
      // Build fisherman name→id lookup
      const fRes = db.exec('SELECT id, name FROM fishermen');
      if (fRes.length) {
        for (const row of fRes[0].values) {
          fishMap.set((row[1] as string).toLowerCase(), row[0] as number);
        }
      }

      // 2. Import Species - build name→id map
      const specMap = new Map<string, number>();
      const specSheet = wb.Sheets['Species'];
      if (specSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(specSheet);
        for (const r of rows) {
          const name = val(r, 'name', 'Name');
          if (!name) continue;
          db.run('INSERT OR IGNORE INTO species (name) VALUES (?)', [name]);
        }
      }
      const sRes = db.exec('SELECT id, name FROM species');
      if (sRes.length) {
        for (const row of sRes[0].values) {
          specMap.set((row[1] as string).toLowerCase(), row[0] as number);
        }
      }

      // 3. Import Passes - build pass_id→new db id map
      const passMap = new Map<string, number>();
      const passSheet = wb.Sheets['Passes'];
      if (passSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(passSheet);
        for (const r of rows) {
          const passId = String(val(r, 'pass_id'));
          const fishName = val(r, 'fisherman_name');
          const fishId = fishMap.get(String(fishName).toLowerCase());
          if (!fishId || !passId) continue;
          db.run('INSERT INTO passes (pass_id, fisherman_id, date, status, notes) VALUES (?,?,?,?,?)',
            [passId, fishId, val(r, 'date') || '', val(r, 'status') || 'pending', val(r, 'notes') || '']);
          const idRes = db.exec('SELECT last_insert_rowid()');
          passMap.set(passId, idRes[0].values[0][0] as number);
        }
      }

      // 4. Import Pass Items
      const itemSheet = wb.Sheets['Pass Items'];
      if (itemSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(itemSheet);
        for (const r of rows) {
          // pass_id in export is the original db id, but we stored pass_id (text) in passes
          // We need to find the new pass db id. The export has pass_id as the DB integer id.
          // But our passMap is keyed by pass_id text. Let's try matching.
          const specName = val(r, 'species_name');
          const specId = specMap.get(String(specName).toLowerCase());
          // Try to find the pass by looking up original pass_id column
          const origPassDbId = val(r, 'pass_id');
          // We need to find which pass_id text corresponds to this db id from the export
          // Since the passes sheet has 'id' and 'pass_id', let's build a reverse map
          let newPassDbId: number | undefined;
          // Search passMap values - we'll build a secondary map from export
          if (!newPassDbId) {
            // Fallback: try to find by iterating passes sheet data
            const passRows = passSheet ? XLSX.utils.sheet_to_json<any>(passSheet) : [];
            const matchedPass = passRows.find((p: any) => val(p, 'id') == origPassDbId);
            if (matchedPass) {
              newPassDbId = passMap.get(String(val(matchedPass, 'pass_id')));
            }
          }
          if (!newPassDbId || !specId) continue;
          db.run('INSERT INTO pass_items (pass_id, species_id, quantity, unit, price_per_unit, total) VALUES (?,?,?,?,?,?)',
            [newPassDbId, specId, Number(val(r, 'quantity')) || 0, val(r, 'unit') || 'kg',
             Number(val(r, 'price_per_unit')) || 0, Number(val(r, 'total')) || 0]);
        }
      }

      // 5. Import Transactions
      const txMap = new Map<number, number>(); // old id → new id
      const txSheet = wb.Sheets['Transactions'];
      if (txSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(txSheet);
        for (const r of rows) {
          const fishName = val(r, 'fisherman_name');
          const fishId = fishMap.get(String(fishName).toLowerCase());
          if (!fishId) continue;
          const oldId = Number(val(r, 'id'));
          db.run(`INSERT INTO transactions (fisherman_id, date, total_fish_value, cash_paid, old_balance, new_balance, notes)
                  VALUES (?,?,?,?,?,?,?)`,
            [fishId, val(r, 'date') || '', Number(val(r, 'total_fish_value')) || 0,
             Number(val(r, 'cash_paid')) || 0, Number(val(r, 'old_balance')) || 0,
             Number(val(r, 'new_balance')) || 0, val(r, 'notes') || '']);
          const idRes = db.exec('SELECT last_insert_rowid()');
          txMap.set(oldId, idRes[0].values[0][0] as number);
        }
      }

      // 6. Import Transaction-Pass links
      const tpSheet = wb.Sheets['Transaction Passes'];
      if (tpSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(tpSheet);
        for (const r of rows) {
          const oldTxId = Number(val(r, 'transaction_id'));
          const passIdText = String(val(r, 'pass_id'));
          const newTxId = txMap.get(oldTxId);
          const newPassId = passMap.get(passIdText);
          if (newTxId && newPassId) {
            db.run('INSERT INTO transaction_passes (transaction_id, pass_id) VALUES (?,?)', [newTxId, newPassId]);
          }
        }
      }

      saveDb();
      toast.success('All data imported! Refreshing...');
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
