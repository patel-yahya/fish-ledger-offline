import { useEffect, useState } from 'react';
import { getDashboardStats, getFishermen, type Fisherman } from '@/lib/database';
import { formatINR } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, TrendingUp, TrendingDown, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({ fishermenCount: 0, pendingPasses: 0, totalDebt: 0, totalCredit: 0, todayPasses: 0 });
  const [topDebtors, setTopDebtors] = useState<Fisherman[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await getDashboardStats();
      setStats(s);
      const fish = await getFishermen();
      setTopDebtors(fish.filter(f => f.running_balance > 0).sort((a, b) => b.running_balance - a.running_balance).slice(0, 5));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const statCards = [
    { label: 'Fishermen', value: stats.fishermenCount, icon: Users, color: 'text-primary' },
    { label: 'Pending Passes', value: stats.pendingPasses, icon: ClipboardList, color: 'text-warning' },
    { label: 'Total Debt', value: formatINR(stats.totalDebt), icon: TrendingUp, color: 'text-destructive' },
    { label: 'Total Credit', value: formatINR(stats.totalCredit), icon: TrendingDown, color: 'text-success' },
    { label: "Today's Passes", value: stats.todayPasses, icon: CalendarDays, color: 'text-info' },
  ];

  return (
    <div className="p-4 space-y-5 animate-slide-in">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(s => (
          <Card key={s.label} className="ledger-shadow border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={16} className={s.color} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-xl font-bold rupee">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {topDebtors.length > 0 && (
        <Card className="ledger-shadow border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Outstanding Balances</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {topDebtors.map(f => (
                <Link key={f.id} to={`/fishermen/${f.id}`} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.village}</p>
                  </div>
                  <span className="rupee text-sm text-destructive">{formatINR(f.running_balance)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/passes" className="block">
          <Card className="ledger-shadow border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <ClipboardList className="mx-auto mb-2 text-primary" size={28} />
              <p className="font-medium text-sm">New Pass</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/settlement" className="block">
          <Card className="ledger-shadow border-border/50 hover:border-secondary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-2 text-secondary" size={28} />
              <p className="font-medium text-sm">Settle Passes</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
