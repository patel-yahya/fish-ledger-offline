import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getFishermen, getPasses, getTransactions, getPassItems, getSpecies,
  addPass, updatePass, deletePass, addManualTransaction, updateTransaction, deleteTransaction,
  type Fisherman, type Pass, type Transaction, type PassItem, type Species
} from '@/lib/database';
import { formatINR, formatDate, todayISO } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Plus, Edit2, Trash2, X, IndianRupee, HandCoins } from 'lucide-react';
import { generatePDF } from '@/lib/pdf';
import { toast } from 'sonner';

interface ItemForm { species_id: number; quantity: string; unit: string; price_per_unit?: number; total?: number; }

export default function FishermanDetail() {
  const { id } = useParams();
  const fid = Number(id);
  const [fisherman, setFisherman] = useState<Fisherman | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [passItemsMap, setPassItemsMap] = useState<Record<number, PassItem[]>>({});
  const [species, setSpecies] = useState<Species[]>([]);

  // Pass dialog
  const [passOpen, setPassOpen] = useState(false);
  const [editingPass, setEditingPass] = useState<Partial<Pass> | null>(null);
  const [items, setItems] = useState<ItemForm[]>([]);

  // Transaction edit dialog
  const [txOpen, setTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editCash, setEditCash] = useState('');
  const [editFishValue, setEditFishValue] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Advance dialog
  const [advOpen, setAdvOpen] = useState(false);
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState(todayISO());
  const [advNotes, setAdvNotes] = useState('');

  // Receive money dialog
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvAmount, setRecvAmount] = useState('');
  const [recvDate, setRecvDate] = useState(todayISO());
  const [recvNotes, setRecvNotes] = useState('');

  const load = async () => {
    const all = await getFishermen();
    setFisherman(all.find(f => f.id === fid) || null);
    const p = await getPasses(fid);
    setPasses(p);
    setTransactions(await getTransactions(fid));
    const itemsMap: Record<number, PassItem[]> = {};
    for (const pass of p) itemsMap[pass.id] = await getPassItems(pass.id);
    setPassItemsMap(itemsMap);
    setSpecies(await getSpecies());
  };
  useEffect(() => { load(); }, [fid]);

  // --- Pass CRUD ---
  const openNewPass = () => {
    setEditingPass({ date: todayISO(), pass_id: '', fisherman_id: fid });
    setItems([{ species_id: 0, quantity: '', unit: 'Kg' }]);
    setPassOpen(true);
  };

  const openEditPass = async (p: Pass) => {
    const pi = await getPassItems(p.id);
    setEditingPass({ ...p, fisherman_id: fid });
    setItems(pi.map(i => ({ species_id: i.species_id, quantity: String(i.quantity), unit: i.unit, price_per_unit: i.price_per_unit, total: i.total })));
    setPassOpen(true);
  };

  const handleSavePass = async () => {
    if (!editingPass?.pass_id?.trim()) { toast.error('Pass ID required'); return; }
    const validItems = items.filter(i => i.species_id && Number(i.quantity) > 0);
    if (!validItems.length) { toast.error('Add at least one item'); return; }
    const itemData = validItems.map(i => ({
      species_id: i.species_id, quantity: Number(i.quantity), unit: i.unit,
      price_per_unit: i.price_per_unit || 0, total: i.total || 0
    }));
    if (editingPass.id) await updatePass(editingPass, itemData);
    else await addPass({ ...editingPass, fisherman_id: fid }, itemData);
    setPassOpen(false);
    setEditingPass(null);
    await load();
    toast.success('Pass saved');
  };

  const handleDeletePass = async (pid: number) => {
    if (!confirm('Delete this pass?')) return;
    await deletePass(pid);
    await load();
    toast.success('Pass deleted');
  };

  // --- Transaction CRUD ---
  const openEditTx = (t: Transaction) => {
    setEditingTx(t);
    setEditCash(String(t.cash_paid));
    setEditFishValue(String(t.total_fish_value));
    setEditDate(t.date);
    setEditNotes(t.notes || '');
    setTxOpen(true);
  };

  const handleSaveTx = async () => {
    if (!editingTx) return;
    await updateTransaction(editingTx.id, Number(editCash) || 0, Number(editFishValue) || 0, editDate, editNotes);
    setTxOpen(false);
    setEditingTx(null);
    await load();
    toast.success('Transaction updated');
  };

  const handleDeleteTx = async (tid: number) => {
    if (!confirm('Delete this transaction? Balance will be recalculated.')) return;
    await deleteTransaction(tid);
    await load();
    toast.success('Transaction deleted');
  };

  // --- Advance ---
  const handleAdvance = async () => {
    const amt = Number(advAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    await addManualTransaction(fid, amt, 0, advDate, advNotes || 'Advance payment');
    setAdvOpen(false);
    setAdvAmount('');
    setAdvDate(todayISO());
    setAdvNotes('');
    await load();
    toast.success('Advance recorded');
  };

  // --- Receive Money ---
  const handleReceive = async () => {
    const amt = Number(recvAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    await addManualTransaction(fid, 0, amt, recvDate, recvNotes || 'Money received from fisherman');
    setRecvOpen(false);
    setRecvAmount('');
    setRecvDate(todayISO());
    setRecvNotes('');
    await load();
    toast.success('Payment received');
  };

  if (!fisherman) return <div className="p-4 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <div className="flex items-center gap-2">
        <Link to="/fishermen"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
        <h1 className="text-xl font-bold truncate">{fisherman.name}</h1>
      </div>

      <Card className="ledger-shadow border-border/50">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">{fisherman.village} {fisherman.phone && `• ${fisherman.phone}`}</p>
            </div>
            <div className="text-right">
              <p className={`rupee text-lg font-bold ${fisherman.running_balance > 0 ? 'text-destructive' : fisherman.running_balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {formatINR(fisherman.running_balance)}
              </p>
              <p className="text-[10px] text-muted-foreground">{fisherman.running_balance > 0 ? 'Outstanding Debt' : fisherman.running_balance < 0 ? 'Credit Balance' : 'Settled'}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => generatePDF(fisherman, passes, passItemsMap, transactions)}>
              <FileText size={14} className="mr-1" /> PDF Hisaab
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setAdvOpen(true); }}>
              <IndianRupee size={14} className="mr-1" /> Advance
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => { setRecvOpen(true); }}>
              <HandCoins size={14} className="mr-1" /> Receive
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="passes">
        <TabsList className="w-full">
          <TabsTrigger value="passes" className="flex-1">Passes ({passes.length})</TabsTrigger>
          <TabsTrigger value="transactions" className="flex-1">Transactions ({transactions.length})</TabsTrigger>
        </TabsList>

        {/* PASSES TAB */}
        <TabsContent value="passes" className="space-y-2 mt-3">
          <Button size="sm" className="w-full" onClick={openNewPass}><Plus size={14} className="mr-1" /> New Pass</Button>
          {passes.map(p => (
            <Card key={p.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold">#{p.pass_id}</p>
                      <Badge variant={p.status === 'pending' ? 'secondary' : 'default'} className={p.status === 'settled' ? 'bg-success text-success-foreground' : ''}>
                        {p.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(p.date)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditPass(p)}><Edit2 size={13} /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDeletePass(p.id)}><Trash2 size={13} /></Button>
                  </div>
                </div>
                {passItemsMap[p.id]?.map(item => (
                  <div key={item.id} className="text-xs text-muted-foreground mt-1">
                    {item.species_name}: {item.quantity} {item.unit}
                    {item.price_per_unit > 0 && ` @ ${formatINR(item.price_per_unit)} = ${formatINR(item.total)}`}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {passes.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">No passes yet</p>}
        </TabsContent>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="space-y-2 mt-3">
          {transactions.map(t => (
            <Card key={t.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditTx(t)}><Edit2 size={13} /></Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => handleDeleteTx(t.id)}><Trash2 size={13} /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div><span className="text-muted-foreground">Fish Value:</span> <span className="rupee">{formatINR(t.total_fish_value)}</span></div>
                  <div><span className="text-muted-foreground">Cash Paid:</span> <span className="rupee">{formatINR(t.cash_paid)}</span></div>
                  <div><span className="text-muted-foreground">Old Bal:</span> <span className="rupee">{formatINR(t.old_balance)}</span></div>
                  <div><span className="text-muted-foreground">New Bal:</span> <span className="rupee font-bold">{formatINR(t.new_balance)}</span></div>
                </div>
                {t.notes && <p className="text-xs text-muted-foreground mt-1 italic">{t.notes}</p>}
              </CardContent>
            </Card>
          ))}
          {transactions.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">No transactions yet</p>}
        </TabsContent>
      </Tabs>

      {/* PASS DIALOG */}
      <Dialog open={passOpen} onOpenChange={v => { setPassOpen(v); if (!v) setEditingPass(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPass?.id ? 'Edit' : 'New'} Pass</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Pass ID (from slip) *</Label><Input value={editingPass?.pass_id || ''} onChange={e => setEditingPass(p => ({ ...p, pass_id: e.target.value }))} placeholder="Enter paper slip ID" /></div>
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
            <div>
              <Label>Cash Given (Advance)</Label>
              <Input type="number" value={editingPass?.cash_given || ''} onChange={e => setEditingPass(p => ({ ...p, cash_given: Number(e.target.value) || 0 }))} placeholder="₹ 0 (optional)" />
            </div>
            <div><Label>Notes</Label><Input value={editingPass?.notes || ''} onChange={e => setEditingPass(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button onClick={handleSavePass} className="w-full">Save Pass</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TRANSACTION EDIT DIALOG */}
      <Dialog open={txOpen} onOpenChange={v => { setTxOpen(v); if (!v) setEditingTx(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
            <div><Label>Total Fish Value</Label><Input type="number" value={editFishValue} onChange={e => setEditFishValue(e.target.value)} placeholder="₹" /></div>
            <div><Label>Cash Paid</Label><Input type="number" value={editCash} onChange={e => setEditCash(e.target.value)} placeholder="₹" /></div>
            <div><Label>Notes</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>
            <Button onClick={handleSaveTx} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADVANCE DIALOG */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Advance Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount *</Label><Input type="number" value={advAmount} onChange={e => setAdvAmount(e.target.value)} placeholder="₹ 0" /></div>
            <div><Label>Date</Label><Input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={advNotes} onChange={e => setAdvNotes(e.target.value)} placeholder="Advance payment" /></div>
            <Button onClick={handleAdvance} className="w-full">Record Advance</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
