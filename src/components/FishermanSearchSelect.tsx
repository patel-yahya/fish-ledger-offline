import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Fisherman } from '@/lib/database';

interface Props {
  fishermen: Fisherman[];
  value: number | string;
  onSelect: (id: number | string) => void;
  placeholder?: string;
  showAll?: boolean;
  formatLabel?: (f: Fisherman) => string;
}

export default function FishermanSearchSelect({ fishermen, value, onSelect, placeholder = 'Select fisherman', showAll = false, formatLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return fishermen;
    const q = search.toLowerCase();
    return fishermen.filter(f => f.name.toLowerCase().includes(q) || f.village.toLowerCase().includes(q));
  }, [fishermen, search]);

  const selectedName = (() => {
    if (showAll && value === 'all') return 'All Fishermen';
    const f = fishermen.find(f => f.id === Number(value));
    return f ? (formatLabel ? formatLabel(f) : f.name) : placeholder;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">{selectedName}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or village..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {showAll && (
            <button
              className={cn("flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-left", value === 'all' && 'bg-accent')}
              onClick={() => { onSelect('all'); setOpen(false); setSearch(''); }}
            >
              <Check className={cn("h-3.5 w-3.5", value === 'all' ? 'opacity-100' : 'opacity-0')} />
              All Fishermen
            </button>
          )}
          {filtered.map(f => (
            <button
              key={f.id}
              className={cn("flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-left", Number(value) === f.id && 'bg-accent')}
              onClick={() => { onSelect(f.id); setOpen(false); setSearch(''); }}
            >
              <Check className={cn("h-3.5 w-3.5", Number(value) === f.id ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">{formatLabel ? formatLabel(f) : f.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No match</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
