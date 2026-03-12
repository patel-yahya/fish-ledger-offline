import { useEffect, useState } from 'react';
import { getSpecies, addSpecies, updateSpecies, deleteSpecies, type Species } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Trash2, Fish } from 'lucide-react';
import { toast } from 'sonner';

export default function SpeciesPage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [editing, setEditing] = useState<{ id?: number; name: string } | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => setSpecies(await getSpecies());
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing?.name?.trim()) { toast.error('Name is required'); return; }
    try {
      if (editing.id) await updateSpecies(editing.id, editing.name);
      else await addSpecies(editing.name);
      setOpen(false); setEditing(null); await load();
      toast.success('Saved');
    } catch { toast.error('Species already exists'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this species?')) return;
    await deleteSpecies(id);
    await load();
    toast.success('Deleted');
  };

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Species</h1>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({ name: '' })}><Plus size={16} className="mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Add'} Species</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={editing?.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} placeholder="e.g. Pomfret, Kingfish" /></div>
              <Button onClick={handleSave} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {species.map(s => (
          <Card key={s.id} className="border-border/50">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fish size={16} className="text-primary" />
                <span className="font-medium text-sm">{s.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setEditing(s); setOpen(true); }}><Edit2 size={13} /></Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDelete(s.id)}><Trash2 size={13} /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {species.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No species. Add fish varieties to get started!</p>}
      </div>
    </div>
  );
}
