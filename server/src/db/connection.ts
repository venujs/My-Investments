import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: SqlJsDatabase;
let dbPath: string;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

class PreparedStatement {
  constructor(private database: SqlJsDatabase, private sql: string) {}

  get(...params: any[]): any {
    const stmt = this.database.prepare(this.sql);
    stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      stmt.free();
      const row: any = {};
      cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params: any[]): any[] {
    const results: any[] = [];
    const stmt = this.database.prepare(this.sql);
    stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row: any = {};
      cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
      results.push(row);
    }
    stmt.free();
    return results;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    this.database.run(this.sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
    const changes = this.database.getRowsModified();
    const lastRow = this.database.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = lastRow.length > 0 ? (lastRow[0].values[0][0] as number) : 0;
    scheduleSave();
    return { changes, lastInsertRowid };
  }
}

class DatabaseWrapper {
  constructor(private database: SqlJsDatabase) {}

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.database, sql);
  }

  exec(sql: string): void {
    this.database.exec(sql);
    scheduleSave();
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.database.exec('BEGIN TRANSACTION');
      try {
        const result = fn();
        this.database.exec('COMMIT');
        scheduleSave();
        return result;
      } catch (err) {
        this.database.exec('ROLLBACK');
        throw err;
      }
    };
  }

  pragma(pragma: string): void {
    try {
      this.database.exec(`PRAGMA ${pragma}`);
    } catch {
      // Some pragmas may not be supported by sql.js
    }
  }

  close(): void {
    saveToDisk();
    this.database.close();
  }
}

let wrapper: DatabaseWrapper;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDisk, 1000);
}

function saveToDisk() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

export async function initializeDbAsync(): Promise<void> {
  const SQL = await initSqlJs();
  dbPath = path.resolve(process.env.DB_PATH || './data/my-investments.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  wrapper = new DatabaseWrapper(db);

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Migration: update market_prices CHECK constraint to include 'manual' source
  try {
    // Test if 'manual' source is allowed
    db.exec(`INSERT INTO market_prices (symbol, source, date, price_paise) VALUES ('__test__', 'manual', '2000-01-01', 0)`);
    db.exec(`DELETE FROM market_prices WHERE symbol = '__test__'`);
  } catch {
    // Constraint doesn't allow 'manual' — recreate the table
    try {
      db.exec(`ALTER TABLE market_prices RENAME TO market_prices_old`);
      db.exec(`CREATE TABLE market_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        source TEXT NOT NULL CHECK(source IN ('mfapi', 'yahoo', 'manual')),
        date TEXT NOT NULL,
        price_paise INTEGER NOT NULL,
        UNIQUE(symbol, source, date)
      )`);
      db.exec(`INSERT INTO market_prices (id, symbol, source, date, price_paise) SELECT id, symbol, source, date, price_paise FROM market_prices_old`);
      db.exec(`DROP TABLE market_prices_old`);
    } catch { /* ignore if migration fails */ }
  }

  // Migration: add purchase_date column to investment_gold
  try {
    db.exec(`ALTER TABLE investment_gold ADD COLUMN purchase_date TEXT`);
  } catch {
    // Column already exists
  }

  // Migration: rename amfi_code to isin_code in investment_mf
  try {
    db.exec(`ALTER TABLE investment_mf RENAME COLUMN amfi_code TO isin_code`);
  } catch {
    // Column already renamed or does not exist
  }

  // Migration: add scheme_code column to investment_mf for reliable NAV fetching
  try {
    db.exec(`ALTER TABLE investment_mf ADD COLUMN scheme_code TEXT`);
  } catch {
    // Column already exists
  }
  // For rows where isin_code is a legacy numeric AMFI code, copy it to scheme_code
  try {
    db.exec(`UPDATE investment_mf SET scheme_code = isin_code WHERE scheme_code IS NULL AND isin_code GLOB '[0-9]*'`);
  } catch { /* ignore */ }

  saveToDisk();
}

export function getDb(): DatabaseWrapper {
  if (!wrapper) {
    throw new Error('Database not initialized. Call initializeDbAsync() first.');
  }
  return wrapper as any;
}

export function closeDb(): void {
  if (saveTimer) clearTimeout(saveTimer);
  if (wrapper) {
    saveToDisk();
    wrapper.close();
  }
}
