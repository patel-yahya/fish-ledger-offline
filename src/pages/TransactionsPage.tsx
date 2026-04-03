import { useEffect, useState } from 'react';
import { getTransactions, deleteTransaction, updateTransaction, type Transaction } from '@/lib/database';
import { formatINR, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editCash, setEditCash] = useState('');
  const [editFishValue, setEditFishValue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [open, setOpen] = useState(false);

  const load = async () => setTransactions(await getTransactions());
  useEffect(() => { load(); }, []);

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setEditCash(String(t.cash_paid));
    setEditFishValue(String(t.total_fish_value));
    setEditDate(t.date);
    setEditNotes(t.notes || '');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    await updateTransaction(editing.id, Number(editCash) || 0, Number(editFishValue) || 0, editDate, editNotes);
    setOpen(false);
    setEditing(null);
    await load();
    toast.success('Transaction updated');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this transaction? Balance will be recalculated.')) return;
    await deleteTransaction(id);
    await load();
    toast.success('Deleted');
  };

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <h1 className="text-2xl font-bold">Transactions</h1>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
            <div><Label>Total Fish Value</Label><Input type="number" value={editFishValue} onChange={e => setEditFishValue(e.target.value)} placeholder="₹" /></div>
            <div><Label>Cash Paid</Label><Input type="number" value={editCash} onChange={e => setEditCash(e.target.value)} placeholder="₹" /></div>
            <div><Label>Notes</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>
            <Button onClick={handleSave} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {transactions.map(t => (
          <Card key={t.id} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{t.fisherman_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(t)}><Edit2 size={13} /></Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {t.cash_paid < 0 ? (
                  <>
                    <div className="col-span-2"><span className="text-muted-foreground">Money Received:</span> <span className="rupee text-green-600 font-semibold">{formatINR(Math.abs(t.cash_paid))}</span></div>
                  </>
                ) : (
                  <>
                    <div><span className="text-muted-foreground">Fish Value:</span> <span className="rupee">{formatINR(t.total_fish_value)}</span></div>
                    <div><span className="text-muted-foreground">Cash Paid:</span> <span className="rupee">{formatINR(t.cash_paid)}</span></div>
                  </>
                )}
                <div><span className="text-muted-foreground">Old Bal:</span> <span className="rupee">{formatINR(t.old_balance)}</span></div>
                <div><span className="text-muted-foreground">New Bal:</span> <span className="rupee font-bold">{formatINR(t.new_balance)}</span></div>
              </div>
              {t.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>}
            </CardContent>
          </Card>
        ))}
        {transactions.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No transactions yet</p>}
      </div>
    </div>
  );
}
