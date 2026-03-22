import { useEffect, useState } from 'react';
import { getPasses, getPassItems, addPass, updatePass, deletePass, getFishermen, getSpecies, type Pass, type PassItem, type Fisherman, type Species } from '@/lib/database';
import { formatDate, todayISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FishermanSearchSelect from '@/components/FishermanSearchSelect';
import { Plus, Trash2, Edit2, X, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface ItemForm { species_id: number; quantity: string; unit: string; price_per_unit?: number; total?: number; }

export default function PassesPage() {
  const [allPasses, setAllPasses] = useState<Pass[]>([]);
  const [passItems, setPassItems] = useState<Record<number, PassItem[]>>({});
  const [fishermen, setFishermen] = useState<Fisherman[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [open, setOpen] = useState(false);
  const [editingPass, setEditingPass] = useState<Partial<Pass> | null>(null);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [filterFisherman, setFilterFisherman] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  const load = async () => {
    const p = await getPasses();
    setAllPasses(p);
    const map: Record<number, PassItem[]> = {};
    for (const pass of p) map[pass.id] = await getPassItems(pass.id);
    setPassItems(map);
    setFishermen(await getFishermen());
    setSpecies(await getSpecies());
  };
  useEffect(() => { load(); }, []);

  const filtered = allPasses.filter(p => {
    if (filterFisherman !== 'all' && p.fisherman_id !== Number(filterFisherman)) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const openNew = () => {
    setEditingPass({ date: todayISO(), pass_id: '', cash_given: 0 });
    setItems([{ species_id: 0, quantity: '', unit: 'Kg' }]);
    setOpen(true);
  };

  const openEdit = async (p: Pass) => {
    const pi = await getPassItems(p.id);
    setEditingPass(p);
    setItems(pi.map(i => ({ species_id: i.species_id, quantity: String(i.quantity), unit: i.unit, price_per_unit: i.price_per_unit, total: i.total })));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!editingPass?.pass_id?.trim()) { toast.error('Pass ID required'); return; }
    if (!editingPass.fisherman_id) { toast.error('Select fisherman'); return; }
    const validItems = items.filter(i => i.species_id && Number(i.quantity) > 0);
    if (!validItems.length) { toast.error('Add at least one item'); return; }

    const itemData = validItems.map(i => ({
      species_id: i.species_id, quantity: Number(i.quantity), unit: i.unit,
      price_per_unit: i.price_per_unit || 0, total: i.total || 0
    }));

    if (editingPass.id) await updatePass(editingPass, itemData);
    else await addPass(editingPass, itemData);

    setOpen(false); setEditingPass(null);
    await load();
    toast.success('Saved');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this pass?')) return;
    await deletePass(id);
    await load();
    toast.success('Deleted');
  };

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Passes</h1>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingPass(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus size={16} className="mr-1" /> New Pass</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingPass?.id ? 'Edit' : 'New'} Pass</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Pass ID (from slip) *</Label><Input value={editingPass?.pass_id || ''} onChange={e => setEditingPass(p => ({ ...p, pass_id: e.target.value }))} placeholder="Enter paper slip ID" /></div>
              <div>
                <Label>Fisherman *</Label>
                <FishermanSearchSelect fishermen={fishermen} value={editingPass?.fisherman_id || 0} onSelect={v => setEditingPass(p => ({ ...p, fisherman_id: Number(v) }))} />
              </div>
              <div><Label>Date</Label><Input type="date" value={editingPass?.date || todayISO()} onChange={e => setEditingPass(p => ({ ...p, date: e.target.value }))} /></div>

              <div>
                <Label className="mb-2 block">Items</Label>
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-end">
                    <div className="flex-1">
                      {i === 0 && <span className="text-[10px] text-muted-foreground">Species</span>}
                      <Select value={String(item.species_id || '')} onValueChange={v => { const n = [...items]; n[i].species_id = Number(v); setItems(n); }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Species" /></SelectTrigger>
                        <SelectContent>{species.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      {i === 0 && <span className="text-[10px] text-muted-foreground">Qty</span>}
                      <Input className="h-9" type="number" value={item.quantity} onChange={e => { const n = [...items]; n[i].quantity = e.target.value; setItems(n); }} />
                    </div>
                    <div className="w-24">
                      {i === 0 && <span className="text-[10px] text-muted-foreground">Unit</span>}
                      <Select value={item.unit} onValueChange={v => { const n = [...items]; n[i].unit = v; setItems(n); }}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kg">Kg</SelectItem>
                          <SelectItem value="Crates">Crates</SelectItem>
                          <SelectItem value="Nos">Nos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {items.length > 1 && <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setItems(items.filter((_, j) => j !== i))}><X size={14} /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setItems([...items, { species_id: 0, quantity: '', unit: 'Kg' }])}>
                  <Plus size={14} className="mr-1" /> Add Item
                </Button>
              </div>

              <div><Label>Notes</Label><Input value={editingPass?.notes || ''} onChange={e => setEditingPass(p => ({ ...p, notes: e.target.value }))} /></div>
              <Button onClick={handleSave} className="w-full">Save Pass</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="flex-1 h-9">
            <Filter size={14} className="mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="all">All Status</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1">
          <FishermanSearchSelect fishermen={fishermen} value={filterFisherman} onSelect={v => setFilterFisherman(String(v))} showAll />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(p => (
          <Card key={p.id} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">#{p.pass_id}</span>
                    <Badge variant={p.status === 'pending' ? 'secondary' : 'default'} className={`text-[10px] ${p.status === 'settled' ? 'bg-success text-success-foreground' : ''}`}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.fisherman_name} • {formatDate(p.date)}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(p)}><Edit2 size={13} /></Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
              {passItems[p.id]?.map(item => (
                <div key={item.id} className="text-xs text-muted-foreground mt-1">
                  {item.species_name}: {item.quantity} {item.unit}
                  {item.price_per_unit > 0 && ` @ ₹${item.price_per_unit}`}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No passes found</p>}
      </div>
    </div>
  );
}
