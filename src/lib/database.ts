import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;
const DB_KEY = 'chand_fish_ledger_db';

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });

    const saved = localStorage.getItem(DB_KEY);
    if (saved) {
      try {
        const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
        db = new SQL.Database(buf);
      } catch (error) {
        console.error('Failed to restore local database, creating a new one.', error);
        localStorage.removeItem(DB_KEY);
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
    }

    initTables(db);
    return db;
  })();

  try {
    return await dbPromise;
  } finally {
    dbPromise = null;
  }
}

function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS fishermen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      village TEXT,
      notes TEXT,
      running_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS species (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_id TEXT NOT NULL,
      fisherman_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (fisherman_id) REFERENCES fishermen(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pass_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_id INTEGER NOT NULL,
      species_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      price_per_unit REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (pass_id) REFERENCES passes(id) ON DELETE CASCADE,
      FOREIGN KEY (species_id) REFERENCES species(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fisherman_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_fish_value REAL DEFAULT 0,
      cash_paid REAL DEFAULT 0,
      old_balance REAL DEFAULT 0,
      new_balance REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (fisherman_id) REFERENCES fishermen(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transaction_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      pass_id INTEGER NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (pass_id) REFERENCES passes(id)
    );
  `);
  saveDb();
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const str = btoa(String.fromCharCode(...data));
  localStorage.setItem(DB_KEY, str);
}

// --- Fishermen ---
export interface Fisherman {
  id: number;
  name: string;
  phone: string;
  village: string;
  notes: string;
  running_balance: number;
  created_at: string;
}

export async function getFishermen(): Promise<Fisherman[]> {
  const d = await getDb();
  const res = d.exec('SELECT * FROM fishermen ORDER BY name');
  if (!res.length) return [];
  return res[0].values.map(r => ({
    id: r[0] as number, name: r[1] as string, phone: r[2] as string || '',
    village: r[3] as string || '', notes: r[4] as string || '',
    running_balance: r[5] as number, created_at: r[6] as string
  }));
}

export async function addFisherman(f: Partial<Fisherman>): Promise<void> {
  const d = await getDb();
  d.run('INSERT INTO fishermen (name, phone, village, notes) VALUES (?,?,?,?)',
    [f.name, f.phone || '', f.village || '', f.notes || '']);
  saveDb();
}

export async function updateFisherman(f: Partial<Fisherman>): Promise<void> {
  const d = await getDb();
  d.run('UPDATE fishermen SET name=?, phone=?, village=?, notes=? WHERE id=?',
    [f.name, f.phone || '', f.village || '', f.notes || '', f.id]);
  saveDb();
}

export async function deleteFisherman(id: number): Promise<void> {
  const d = await getDb();
  d.run('DELETE FROM fishermen WHERE id=?', [id]);
  saveDb();
}

export async function updateFishermanBalance(id: number, balance: number): Promise<void> {
  const d = await getDb();
  d.run('UPDATE fishermen SET running_balance=? WHERE id=?', [balance, id]);
  saveDb();
}

// --- Species ---
export interface Species {
  id: number;
  name: string;
}

export async function getSpecies(): Promise<Species[]> {
  const d = await getDb();
  const res = d.exec('SELECT id, name FROM species ORDER BY name');
  if (!res.length) return [];
  return res[0].values.map(r => ({ id: r[0] as number, name: r[1] as string }));
}

export async function addSpecies(name: string): Promise<void> {
  const d = await getDb();
  d.run('INSERT INTO species (name) VALUES (?)', [name]);
  saveDb();
}

export async function updateSpecies(id: number, name: string): Promise<void> {
  const d = await getDb();
  d.run('UPDATE species SET name=? WHERE id=?', [name, id]);
  saveDb();
}

export async function deleteSpecies(id: number): Promise<void> {
  const d = await getDb();
  d.run('DELETE FROM species WHERE id=?', [id]);
  saveDb();
}

// --- Passes ---
export interface Pass {
  id: number;
  pass_id: string;
  fisherman_id: number;
  fisherman_name?: string;
  date: string;
  status: string;
  notes: string;
  items?: PassItem[];
}

export interface PassItem {
  id: number;
  pass_id: number;
  species_id: number;
  species_name?: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total: number;
}

export async function getPasses(fishermanId?: number): Promise<Pass[]> {
  const d = await getDb();
  let q = `SELECT p.*, f.name as fname FROM passes p 
           JOIN fishermen f ON p.fisherman_id = f.id`;
  const params: any[] = [];
  if (fishermanId) { q += ' WHERE p.fisherman_id=?'; params.push(fishermanId); }
  q += ' ORDER BY p.date DESC, p.id DESC';
  const res = d.exec(q, params);
  if (!res.length) return [];
  return res[0].values.map(r => ({
    id: r[0] as number, pass_id: r[1] as string, fisherman_id: r[2] as number,
    date: r[3] as string, status: r[4] as string, notes: r[5] as string || '',
    created_at: r[6] as string, fisherman_name: r[7] as string
  }));
}

export async function getPassItems(passId: number): Promise<PassItem[]> {
  const d = await getDb();
  const res = d.exec(`SELECT pi.*, s.name FROM pass_items pi 
    JOIN species s ON pi.species_id = s.id WHERE pi.pass_id=?`, [passId]);
  if (!res.length) return [];
  return res[0].values.map(r => ({
    id: r[0] as number, pass_id: r[1] as number, species_id: r[2] as number,
    quantity: r[3] as number, unit: r[4] as string,
    price_per_unit: r[5] as number, total: r[6] as number,
    species_name: r[7] as string
  }));
}

export async function addPass(pass: Partial<Pass>, items: Partial<PassItem>[]): Promise<number> {
  const d = await getDb();
  d.run('INSERT INTO passes (pass_id, fisherman_id, date, notes) VALUES (?,?,?,?)',
    [pass.pass_id, pass.fisherman_id, pass.date, pass.notes || '']);
  const idRes = d.exec('SELECT last_insert_rowid()');
  const newId = idRes[0].values[0][0] as number;
  for (const item of items) {
    d.run('INSERT INTO pass_items (pass_id, species_id, quantity, unit) VALUES (?,?,?,?)',
      [newId, item.species_id, item.quantity, item.unit]);
  }
  saveDb();
  return newId;
}

export async function updatePass(pass: Partial<Pass>, items: Partial<PassItem>[]): Promise<void> {
  const d = await getDb();
  d.run('UPDATE passes SET pass_id=?, fisherman_id=?, date=?, notes=? WHERE id=?',
    [pass.pass_id, pass.fisherman_id, pass.date, pass.notes || '', pass.id]);
  d.run('DELETE FROM pass_items WHERE pass_id=?', [pass.id]);
  for (const item of items) {
    d.run('INSERT INTO pass_items (pass_id, species_id, quantity, unit, price_per_unit, total) VALUES (?,?,?,?,?,?)',
      [pass.id, item.species_id, item.quantity, item.unit, item.price_per_unit || 0, item.total || 0]);
  }
  saveDb();
}

export async function deletePass(id: number): Promise<void> {
  const d = await getDb();
  d.run('DELETE FROM pass_items WHERE pass_id=?', [id]);
  d.run('DELETE FROM passes WHERE id=?', [id]);
  saveDb();
}

// --- Transactions ---
export interface Transaction {
  id: number;
  fisherman_id: number;
  fisherman_name?: string;
  date: string;
  total_fish_value: number;
  cash_paid: number;
  old_balance: number;
  new_balance: number;
  notes: string;
  created_at: string;
  pass_ids?: number[];
}

export async function getTransactions(fishermanId?: number): Promise<Transaction[]> {
  const d = await getDb();
  let q = `SELECT t.*, f.name as fname FROM transactions t 
           JOIN fishermen f ON t.fisherman_id = f.id`;
  const params: any[] = [];
  if (fishermanId) { q += ' WHERE t.fisherman_id=?'; params.push(fishermanId); }
  q += ' ORDER BY t.date DESC, t.id DESC';
  const res = d.exec(q, params);
  if (!res.length) return [];
  return res[0].values.map(r => ({
    id: r[0] as number, fisherman_id: r[1] as number, date: r[2] as string,
    total_fish_value: r[3] as number, cash_paid: r[4] as number,
    old_balance: r[5] as number, new_balance: r[6] as number,
    notes: r[7] as string || '', created_at: r[8] as string,
    fisherman_name: r[9] as string
  }));
}

export async function settlePass(
  fishermanId: number, passIds: number[],
  itemPrices: { passItemId: number; pricePerUnit: number }[],
  cashPaid: number, date: string, notes: string
): Promise<void> {
  const d = await getDb();

  // Update prices on items
  for (const ip of itemPrices) {
    d.run('UPDATE pass_items SET price_per_unit=?, total=quantity*? WHERE id=?',
      [ip.pricePerUnit, ip.pricePerUnit, ip.passItemId]);
  }

  // Calculate total fish value
  let totalValue = 0;
  for (const pid of passIds) {
    const r = d.exec('SELECT COALESCE(SUM(total),0) FROM pass_items WHERE pass_id=?', [pid]);
    totalValue += r[0].values[0][0] as number;
  }

  // Get old balance
  const bRes = d.exec('SELECT running_balance FROM fishermen WHERE id=?', [fishermanId]);
  const oldBalance = bRes[0].values[0][0] as number;
  const newBalance = oldBalance + (cashPaid - totalValue);

  // Create transaction
  d.run(`INSERT INTO transactions (fisherman_id, date, total_fish_value, cash_paid, old_balance, new_balance, notes)
         VALUES (?,?,?,?,?,?,?)`,
    [fishermanId, date, totalValue, cashPaid, oldBalance, newBalance, notes]);
  const txRes = d.exec('SELECT last_insert_rowid()');
  const txId = txRes[0].values[0][0] as number;

  // Link passes
  for (const pid of passIds) {
    d.run('INSERT INTO transaction_passes (transaction_id, pass_id) VALUES (?,?)', [txId, pid]);
    d.run("UPDATE passes SET status='settled' WHERE id=?", [pid]);
  }

  // Update fisherman balance
  d.run('UPDATE fishermen SET running_balance=? WHERE id=?', [newBalance, fishermanId]);
  saveDb();
}

export async function addManualTransaction(
  fishermanId: number, cashPaid: number, totalFishValue: number, date: string, notes: string
): Promise<void> {
  const d = await getDb();
  const bRes = d.exec('SELECT running_balance FROM fishermen WHERE id=?', [fishermanId]);
  const oldBalance = bRes[0].values[0][0] as number;
  const newBalance = oldBalance + (cashPaid - totalFishValue);
  d.run(`INSERT INTO transactions (fisherman_id, date, total_fish_value, cash_paid, old_balance, new_balance, notes)
         VALUES (?,?,?,?,?,?,?)`,
    [fishermanId, date, totalFishValue, cashPaid, oldBalance, newBalance, notes]);
  d.run('UPDATE fishermen SET running_balance=? WHERE id=?', [newBalance, fishermanId]);
  saveDb();
}

export async function updateTransaction(
  id: number, cashPaid: number, totalFishValue: number, date: string, notes: string
): Promise<void> {
  const d = await getDb();
  d.run('UPDATE transactions SET cash_paid=?, total_fish_value=?, date=?, notes=? WHERE id=?',
    [cashPaid, totalFishValue, date, notes, id]);
  const tRes = d.exec('SELECT fisherman_id FROM transactions WHERE id=?', [id]);
  if (tRes.length) {
    await recalculateBalance(tRes[0].values[0][0] as number);
  }
}

export async function deleteTransaction(id: number): Promise<void> {
  const d = await getDb();
  // Get transaction info to revert balance
  const tRes = d.exec('SELECT fisherman_id, old_balance FROM transactions WHERE id=?', [id]);
  if (tRes.length) {
    const fishermanId = tRes[0].values[0][0] as number;
    // Revert passes to pending
    const pRes = d.exec('SELECT pass_id FROM transaction_passes WHERE transaction_id=?', [id]);
    if (pRes.length) {
      for (const r of pRes[0].values) {
        d.run("UPDATE passes SET status='pending' WHERE id=?", [r[0]]);
      }
    }
    d.run('DELETE FROM transaction_passes WHERE transaction_id=?', [id]);
    d.run('DELETE FROM transactions WHERE id=?', [id]);
    // Recalculate balance
    await recalculateBalance(fishermanId);
  }
  saveDb();
}

export async function recalculateBalance(fishermanId: number): Promise<void> {
  const d = await getDb();
  const res = d.exec(
    'SELECT id, cash_paid, total_fish_value FROM transactions WHERE fisherman_id=? ORDER BY date, id',
    [fishermanId]
  );
  let balance = 0;
  if (res.length) {
    for (const r of res[0].values) {
      const oldBal = balance;
      balance = balance + (r[1] as number) - (r[2] as number);
      d.run('UPDATE transactions SET old_balance=?, new_balance=? WHERE id=?', [oldBal, balance, r[0]]);
    }
  }
  d.run('UPDATE fishermen SET running_balance=? WHERE id=?', [balance, fishermanId]);
  saveDb();
}

// --- Stats ---
export async function getDashboardStats() {
  const d = await getDb();
  const fishCount = d.exec('SELECT COUNT(*) FROM fishermen');
  const pendingPasses = d.exec("SELECT COUNT(*) FROM passes WHERE status='pending'");
  const totalDebt = d.exec('SELECT COALESCE(SUM(running_balance),0) FROM fishermen WHERE running_balance > 0');
  const totalCredit = d.exec('SELECT COALESCE(SUM(ABS(running_balance)),0) FROM fishermen WHERE running_balance < 0');
  const todayPasses = d.exec("SELECT COUNT(*) FROM passes WHERE date=date('now','localtime')");

  return {
    fishermenCount: fishCount[0]?.values[0][0] as number || 0,
    pendingPasses: pendingPasses[0]?.values[0][0] as number || 0,
    totalDebt: totalDebt[0]?.values[0][0] as number || 0,
    totalCredit: totalCredit[0]?.values[0][0] as number || 0,
    todayPasses: todayPasses[0]?.values[0][0] as number || 0,
  };
}

export async function exportAllData() {
  const d = await getDb();
  const fishermen = d.exec('SELECT * FROM fishermen');
  const species = d.exec('SELECT * FROM species');
  const passes = d.exec(`SELECT p.id, p.pass_id, f.name, p.date, p.status, p.notes 
    FROM passes p JOIN fishermen f ON p.fisherman_id=f.id ORDER BY p.date`);
  const items = d.exec(`SELECT pi.pass_id, s.name, pi.quantity, pi.unit, pi.price_per_unit, pi.total 
    FROM pass_items pi JOIN species s ON pi.species_id=s.id`);
  const transactions = d.exec(`SELECT t.id, f.name, t.date, t.total_fish_value, t.cash_paid, t.old_balance, t.new_balance, t.notes
    FROM transactions t JOIN fishermen f ON t.fisherman_id=f.id ORDER BY t.date`);

  return { fishermen, species, passes, items, transactions };
}
