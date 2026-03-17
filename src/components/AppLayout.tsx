import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Fish, Home, Users, ClipboardList, ArrowLeftRight, Download, Menu, X, Receipt } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/fishermen', icon: Users, label: 'Fishermen' },
  { to: '/species', icon: Fish, label: 'Species' },
  { to: '/passes', icon: ClipboardList, label: 'Passes' },
  { to: '/settlement', icon: ArrowLeftRight, label: 'Settlement' },
  { to: '/data', icon: Download, label: 'Data' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground ledger-shadow">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(!open)} className="p-1.5 rounded-md hover:bg-primary/80 transition-colors">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="flex items-center gap-2">
              <Fish size={24} className="text-secondary" />
              <span className="font-bold text-lg tracking-tight">Chand Fish Ledger</span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <nav className="absolute left-0 top-14 w-64 bg-card rounded-br-lg ledger-shadow-lg animate-slide-in" onClick={e => e.stopPropagation()}>
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors
                  ${location.pathname === item.to
                    ? 'bg-primary/10 text-primary border-l-3 border-primary'
                    : 'text-foreground hover:bg-muted'}`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Bottom Nav for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex justify-around py-1.5 ledger-shadow sm:hidden">
        {navItems.slice(0, 5).map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors rounded-md
              ${location.pathname === item.to ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Content */}
      <main className="pb-20 sm:pb-4">
        {children}
      </main>
    </div>
  );
}
