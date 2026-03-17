import { useEffect, useState } from 'react';
import { getFishermen, addFisherman, updateFisherman, deleteFisherman, addManualTransaction, type Fisherman } from '@/lib/database';
import { todayISO } from '@/lib/format';
import { formatINR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit2, Trash2, Search, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function FishermenPage() {
  const [fishermen, setFishermen] = useState<Fisherman[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Fisherman> | null>(null);
  const [open, setOpen] = useState(false);
  const [advancePayment, setAdvancePayment] = useState('');
  const navigate = useNavigate();

  const load = async () => setFishermen(await getFishermen());
  useEffect(() => { load(); }, []);

  const filtered = fishermen.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.village.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!editing?.name?.trim()) { toast.error('Name is required'); return; }
    const isNew = !editing.id;
    if (isNew) {
      await addFisherman(editing);
      if (Number(advancePayment) > 0) {
        const all = await getFishermen();
        const created = all.find(f => f.name === editing.name);
        if (created) {
          await addManualTransaction(created.id, Number(advancePayment), 0, todayISO(), 'Advance payment');
        }
      }
    } else {
      await updateFisherman(editing);
    }
    setOpen(false);
    setEditing(null);
    setAdvancePayment('');
    await load();
    toast.success(isNew ? 'Added' : 'Updated');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this fisherman and all related data?')) return;
    await deleteFisherman(id);
    await load();
    toast.success('Deleted');
  };

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fishermen</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({})}>
              <Plus size={16} className="mr-1" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Add'} Fisherman</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={editing?.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={editing?.phone || ''} onChange={e => setEditing(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label>Village</Label><Input value={editing?.village || ''} onChange={e => setEditing(p => ({ ...p, village: e.target.value }))} /></div>
              <div><Label>Notes</Label><Textarea value={editing?.notes || ''} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleSave} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or village..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-2">
        {filtered.map(f => (
          <Card key={f.id} className="ledger-shadow border-border/50 cursor-pointer hover:border-primary/20 transition-colors" onClick={() => navigate(`/fishermen/${f.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{f.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {f.village && <span className="flex items-center gap-1"><MapPin size={12} />{f.village}</span>}
                    {f.phone && <span className="flex items-center gap-1"><Phone size={12} />{f.phone}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`rupee text-sm font-bold ${f.running_balance > 0 ? 'text-destructive' : f.running_balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                    {formatINR(f.running_balance)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{f.running_balance > 0 ? 'Debt' : f.running_balance < 0 ? 'Credit' : 'Clear'}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-2 justify-end" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditing(f); setOpen(true); }}><Edit2 size={13} /></Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDelete(f.id)}><Trash2 size={13} /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No fishermen found. Add one to get started!</p>}
      </div>
    </div>
  );
}
