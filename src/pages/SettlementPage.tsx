import { useEffect, useState } from 'react';
import { getFishermen, getPasses, getPassItems, settlePass, type Fisherman, type Pass, type PassItem } from '@/lib/database';
import { formatINR, todayISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FishermanSearchSelect from '@/components/FishermanSearchSelect';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter } from 'lucide-react';
import { toast } from 'sonner';

interface ItemWithPrice extends PassItem {
  newPrice: string;
}

export default function SettlementPage() {
  const [fishermen, setFishermen] = useState<Fisherman[]>([]);
  const [allPendingPasses, setAllPendingPasses] = useState<Pass[]>([]);
  const [filterFisherman, setFilterFisherman] = useState<string>('all');
  const [selectedPasses, setSelectedPasses] = useState<Set<number>>(new Set());
  const [allItems, setAllItems] = useState<Record<number, ItemWithPrice[]>>({});
  const [cashPaid, setCashPaid] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');

  const load = async () => {
    const f = await getFishermen();
    setFishermen(f);
    const passes = await getPasses();
    const pending = passes.filter(p => p.status === 'pending');
    setAllPendingPasses(pending);
    const items: Record<number, ItemWithPrice[]> = {};
    for (const p of pending) {
      const pi = await getPassItems(p.id);
      items[p.id] = pi.map(i => ({ ...i, newPrice: String(i.price_per_unit || '') }));
    }
    setAllItems(items);
  };

  useEffect(() => { load(); }, []);

  const filteredPasses = filterFisherman === 'all'
    ? allPendingPasses
    : allPendingPasses.filter(p => p.fisherman_id === Number(filterFisherman));

  // When settling, all selected passes must belong to the same fisherman
  const selectedFishermanId = (() => {
    const ids = new Set<number>();
    for (const pid of selectedPasses) {
      const pass = allPendingPasses.find(p => p.id === pid);
      if (pass) ids.add(pass.fisherman_id);
    }
    return ids.size === 1 ? [...ids][0] : null;
  })();

  const togglePass = (id: number) => {
    const pass = allPendingPasses.find(p => p.id === id);
    if (!pass) return;

    const s = new Set(selectedPasses);
    if (s.has(id)) {
      s.delete(id);
    } else {
      // Check if adding this pass would mix fishermen
      const existingFids = new Set<number>();
      for (const pid of s) {
        const p = allPendingPasses.find(pp => pp.id === pid);
        if (p) existingFids.add(p.fisherman_id);
      }
      if (existingFids.size > 0 && !existingFids.has(pass.fisherman_id)) {
        toast.error('You can only settle passes for one fisherman at a time');
        return;
      }
      s.add(id);
    }
    setSelectedPasses(s);
  };

  const updatePrice = (passId: number, itemId: number, price: string) => {
    setAllItems(prev => ({
      ...prev,
      [passId]: prev[passId].map(i => i.id === itemId ? { ...i, newPrice: price } : i)
    }));
  };

  const totalFishValue = Array.from(selectedPasses).reduce((sum, pid) => {
    const items = allItems[pid] || [];
    return sum + items.reduce((s, i) => s + (Number(i.newPrice) || 0) * i.quantity, 0);
  }, 0);

  const totalAdvanceGiven = Array.from(selectedPasses).reduce((sum, pid) => {
    const pass = allPendingPasses.find(p => p.id === pid);
    return sum + (pass?.cash_given || 0);
  }, 0);

  const fisherman = selectedFishermanId ? fishermen.find(f => f.id === selectedFishermanId) : null;
  const oldBalance = fisherman?.running_balance || 0;
  const cash = Number(cashPaid) || 0;
  const newBalance = oldBalance + (cash - totalFishValue);

  const handleSettle = async () => {
    if (!selectedFishermanId) { toast.error('Select passes from one fisherman'); return; }
    if (selectedPasses.size === 0) { toast.error('Select passes to settle'); return; }

    const itemPrices: { passItemId: number; pricePerUnit: number }[] = [];
    for (const pid of selectedPasses) {
      for (const item of allItems[pid] || []) {
        if (!Number(item.newPrice)) { toast.error(`Set price for ${item.species_name}`); return; }
        itemPrices.push({ passItemId: item.id, pricePerUnit: Number(item.newPrice) });
      }
    }

    await settlePass(selectedFishermanId, Array.from(selectedPasses), itemPrices, cash, date, notes);
    toast.success('Settlement complete!');
    setCashPaid(''); setNotes(''); setSelectedPasses(new Set());
    await load();
  };

  const handleFilterChange = (v: string) => {
    setFilterFisherman(v);
    setSelectedPasses(new Set());
  };

  return (
    <div className="p-4 space-y-4 animate-slide-in">
      <h1 className="text-2xl font-bold">Settlement</h1>

      <div>
        <Label>Filter by Fisherman</Label>
        <FishermanSearchSelect
          fishermen={fishermen}
          value={filterFisherman}
          onSelect={v => handleFilterChange(String(v))}
          showAll
          formatLabel={f => `${f.name} (${formatINR(f.running_balance)})`}
        />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pending Passes ({filteredPasses.length})</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-3">
          {filteredPasses.length === 0 && <p className="text-sm text-muted-foreground">No pending passes</p>}
          {filteredPasses.map(p => (
            <div key={p.id} className={`p-3 rounded-md border transition-colors ${selectedPasses.has(p.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedPasses.has(p.id)} onCheckedChange={() => togglePass(p.id)} />
                <span className="font-mono text-sm font-semibold">#{p.pass_id}</span>
                <span className="text-xs text-muted-foreground">{p.fisherman_name} • {p.date}</span>
                {p.cash_given > 0 && <Badge variant="outline" className="text-[10px]">Adv: ₹{p.cash_given}</Badge>}
              </div>
              {selectedPasses.has(p.id) && allItems[p.id]?.map(item => (
                <div key={item.id} className="flex items-center gap-2 mt-2 ml-6">
                  <span className="text-xs flex-1">{item.species_name}: {item.quantity} {item.unit}</span>
                  <div className="w-24">
                    <Input className="h-7 text-xs" type="number" placeholder="₹ Price" value={item.newPrice}
                      onChange={e => updatePrice(p.id, item.id, e.target.value)} />
                  </div>
                  <span className="text-xs rupee w-20 text-right">{formatINR((Number(item.newPrice) || 0) * item.quantity)}</span>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedPasses.size > 0 && selectedFishermanId && (
        <Card className="border-primary/30 ledger-shadow">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">{fisherman?.name}</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Fish Value (V)</span>
              <span className="rupee font-bold">{formatINR(totalFishValue)}</span>
            </div>
            <div>
              <Label>Cash Paid (C)</Label>
              <Input type="number" value={cashPaid} onChange={e => setCashPaid(e.target.value)} placeholder="₹ Enter amount" />
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>

            <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
              <div className="flex justify-between"><span>Old Balance</span><span className="rupee">{formatINR(oldBalance)}</span></div>
              <div className="flex justify-between"><span>Cash - Fish Value</span><span className="rupee">{formatINR(cash - totalFishValue)}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                <span>New Balance</span>
                <span className={`rupee ${newBalance > 0 ? 'text-destructive' : 'text-success'}`}>{formatINR(newBalance)}</span>
              </div>
            </div>

            <Button onClick={handleSettle} className="w-full">Confirm Settlement</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
