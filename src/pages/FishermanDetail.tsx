import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFishermen, getPasses, getTransactions, getPassItems, type Fisherman, type Pass, type Transaction, type PassItem } from '@/lib/database';
import { formatINR, formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText } from 'lucide-react';
import { generatePDF } from '@/lib/pdf';

export default function FishermanDetail() {
  const { id } = useParams();
  const fid = Number(id);
  const [fisherman, setFisherman] = useState<Fisherman | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [passItemsMap, setPassItemsMap] = useState<Record<number, PassItem[]>>({});

  useEffect(() => {
    (async () => {
      const all = await getFishermen();
      setFisherman(all.find(f => f.id === fid) || null);
      const p = await getPasses(fid);
      setPasses(p);
      const t = await getTransactions(fid);
      setTransactions(t);
      const itemsMap: Record<number, PassItem[]> = {};
      for (const pass of p) {
        itemsMap[pass.id] = await getPassItems(pass.id);
      }
      setPassItemsMap(itemsMap);
    })();
  }, [fid]);

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
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => generatePDF(fisherman, passes, passItemsMap, transactions)}>
            <FileText size={14} className="mr-1" /> Generate PDF Hisaab
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="passes">
        <TabsList className="w-full">
          <TabsTrigger value="passes" className="flex-1">Passes ({passes.length})</TabsTrigger>
          <TabsTrigger value="transactions" className="flex-1">Transactions ({transactions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="passes" className="space-y-2 mt-3">
          {passes.map(p => (
            <Card key={p.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-sm font-semibold">#{p.pass_id}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.date)}</p>
                  </div>
                  <Badge variant={p.status === 'pending' ? 'secondary' : 'default'} className={p.status === 'settled' ? 'bg-success text-success-foreground' : ''}>
                    {p.status}
                  </Badge>
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
        <TabsContent value="transactions" className="space-y-2 mt-3">
          {transactions.map(t => (
            <Card key={t.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
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
    </div>
  );
}
