import { getDb } from '../db/connection.js';
import type { InvestmentTransaction, InvestmentLot } from 'shared';

export function getTransactions(investmentId: number): InvestmentTransaction[] {
  const db = getDb();
  return db.prepare(
    `SELECT t.*, i.name as investment_name, i.investment_type, u.name as user_name
     FROM investment_transactions t
     JOIN investments i ON t.investment_id = i.id
     JOIN users u ON t.user_id = u.id
     WHERE t.investment_id = ?
     ORDER BY t.date DESC, t.id DESC`
  ).all(investmentId) as InvestmentTransaction[];
}

export function getAllTransactions(userId?: number): InvestmentTransaction[] {
  const db = getDb();
  let sql = `SELECT t.*, i.name as investment_name, i.investment_type, u.name as user_name
     FROM investment_transactions t
     JOIN investments i ON t.investment_id = i.id
     JOIN users u ON t.user_id = u.id`;
  const params: any[] = [];
  if (userId) {
    sql += ' WHERE t.user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY t.date DESC, t.id DESC';
  return db.prepare(sql).all(...params) as InvestmentTransaction[];
}

export function createTransaction(
  investmentId: number,
  userId: number,
  data: {
    txn_type: string;
    date: string;
    amount_paise: number;
    units?: number | null;
    price_per_unit_paise?: number | null;
    fees_paise?: number;
    notes?: string | null;
    recurring_rule_id?: number | null;
    import_batch_id?: number | null;
  }
): InvestmentTransaction {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO investment_transactions (investment_id, user_id, txn_type, date, amount_paise, units, price_per_unit_paise, fees_paise, notes, recurring_rule_id, import_batch_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    investmentId, userId, data.txn_type, data.date, data.amount_paise,
    data.units ?? null, data.price_per_unit_paise ?? null, data.fees_paise || 0,
    data.notes ?? null, data.recurring_rule_id ?? null, data.import_batch_id ?? null
  );
  const txnId = Number(result.lastInsertRowid);

  // Create lot for buy/sip transactions
  if (['buy', 'sip'].includes(data.txn_type) && data.units && data.price_per_unit_paise) {
    db.prepare(
      `INSERT INTO investment_lots (investment_id, buy_txn_id, buy_date, units_bought, units_remaining, cost_per_unit_paise)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(investmentId, txnId, data.date, data.units, data.units, data.price_per_unit_paise);
  }

  return getTransactionById(txnId)!;
}

export function getTransactionById(id: number): InvestmentTransaction | undefined {
  const db = getDb();
  return db.prepare(
    `SELECT t.*, i.name as investment_name, i.investment_type, u.name as user_name
     FROM investment_transactions t
     JOIN investments i ON t.investment_id = i.id
     JOIN users u ON t.user_id = u.id
     WHERE t.id = ?`
  ).get(id) as InvestmentTransaction | undefined;
}

export function updateTransaction(id: number, data: Partial<{
  txn_type: string; date: string; amount_paise: number;
  units: number | null; price_per_unit_paise: number | null;
  fees_paise: number; notes: string | null;
}>): InvestmentTransaction | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (data.txn_type !== undefined) { fields.push('txn_type = ?'); values.push(data.txn_type); }
  if (data.date !== undefined) { fields.push('date = ?'); values.push(data.date); }
  if (data.amount_paise !== undefined) { fields.push('amount_paise = ?'); values.push(data.amount_paise); }
  if (data.units !== undefined) { fields.push('units = ?'); values.push(data.units); }
  if (data.price_per_unit_paise !== undefined) { fields.push('price_per_unit_paise = ?'); values.push(data.price_per_unit_paise); }
  if (data.fees_paise !== undefined) { fields.push('fees_paise = ?'); values.push(data.fees_paise); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (fields.length === 0) return getTransactionById(id);
  values.push(id);
  db.prepare(`UPDATE investment_transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTransactionById(id);
}

export function deleteTransaction(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM investment_transactions WHERE id = ?').run(id);
  return result.changes > 0;
}

// FIFO sell: consume lots oldest first
export function executeSell(
  investmentId: number,
  userId: number,
  date: string,
  units: number,
  pricePerUnitPaise: number,
  feesPaise: number = 0,
  notes: string | null = null
): { txn: InvestmentTransaction; allocations: any[] } {
  const db = getDb();
  const amountPaise = Math.round(units * pricePerUnitPaise);

  // Create sell transaction
  const result = db.prepare(
    `INSERT INTO investment_transactions (investment_id, user_id, txn_type, date, amount_paise, units, price_per_unit_paise, fees_paise, notes)
     VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?)`
  ).run(investmentId, userId, date, amountPaise, units, pricePerUnitPaise, feesPaise, notes);
  const sellTxnId = Number(result.lastInsertRowid);

  // Get available lots sorted by buy_date ASC (FIFO)
  const lots = db.prepare(
    `SELECT * FROM investment_lots WHERE investment_id = ? AND units_remaining > 0 ORDER BY buy_date ASC`
  ).all(investmentId) as InvestmentLot[];

  let remaining = units;
  const allocations: any[] = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const toSell = Math.min(remaining, lot.units_remaining);

    db.prepare(
      `INSERT INTO lot_sell_allocations (sell_txn_id, lot_id, units_sold, cost_per_unit_paise) VALUES (?, ?, ?, ?)`
    ).run(sellTxnId, lot.id, toSell, lot.cost_per_unit_paise);

    db.prepare(
      `UPDATE investment_lots SET units_remaining = units_remaining - ? WHERE id = ?`
    ).run(toSell, lot.id);

    allocations.push({ lot_id: lot.id, units_sold: toSell, cost_per_unit_paise: lot.cost_per_unit_paise });
    remaining -= toSell;
  }

  if (remaining > 0.0001) {
    console.warn(`FIFO sell: ${remaining} units could not be allocated from lots for investment ${investmentId}`);
  }

  const txn = getTransactionById(sellTxnId)!;
  return { txn, allocations };
}

// Get lots for an investment
export function getLots(investmentId: number): InvestmentLot[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM investment_lots WHERE investment_id = ? ORDER BY buy_date ASC`
  ).all(investmentId) as InvestmentLot[];
}

// Get total invested (sum of buys - sells) for an investment
export function getTotalInvested(investmentId: number): number {
  const db = getDb();
  const buys = db.prepare(
    `SELECT COALESCE(SUM(amount_paise), 0) as total FROM investment_transactions WHERE investment_id = ? AND txn_type IN ('buy', 'sip', 'deposit', 'premium')`
  ).get(investmentId) as { total: number };
  const sells = db.prepare(
    `SELECT COALESCE(SUM(amount_paise), 0) as total FROM investment_transactions WHERE investment_id = ? AND txn_type IN ('sell', 'withdrawal', 'maturity')`
  ).get(investmentId) as { total: number };
  return buys.total - sells.total;
}

// Get total units remaining
export function getTotalUnits(investmentId: number): number {
  const db = getDb();
  const row = db.prepare(
    `SELECT COALESCE(SUM(units_remaining), 0) as total FROM investment_lots WHERE investment_id = ?`
  ).get(investmentId) as { total: number };
  return row.total;
}

// Get total units as of a specific date
export function getTotalUnitsAsOf(investmentId: number, asOfDate: string): number {
  const db = getDb();
  const buys = db.prepare(
    `SELECT COALESCE(SUM(units), 0) as total FROM investment_transactions
     WHERE investment_id = ? AND txn_type IN ('buy', 'sip') AND date <= ? AND units IS NOT NULL`
  ).get(investmentId, asOfDate) as { total: number };
  const sells = db.prepare(
    `SELECT COALESCE(SUM(units), 0) as total FROM investment_transactions
     WHERE investment_id = ? AND txn_type = 'sell' AND date <= ? AND units IS NOT NULL`
  ).get(investmentId, asOfDate) as { total: number };
  return buys.total - sells.total;
}

// Get total invested as of a specific date
export function getTotalInvestedAsOf(investmentId: number, asOfDate: string): number {
  const db = getDb();
  const buys = db.prepare(
    `SELECT COALESCE(SUM(amount_paise), 0) as total FROM investment_transactions WHERE investment_id = ? AND txn_type IN ('buy', 'sip', 'deposit', 'premium') AND date <= ?`
  ).get(investmentId, asOfDate) as { total: number };
  const sells = db.prepare(
    `SELECT COALESCE(SUM(amount_paise), 0) as total FROM investment_transactions WHERE investment_id = ? AND txn_type IN ('sell', 'withdrawal', 'maturity') AND date <= ?`
  ).get(investmentId, asOfDate) as { total: number };
  return buys.total - sells.total;
}

export function deleteAllTransactions(userId?: number): number {
  const db = getDb();
  if (userId) {
    // Delete lots and sell allocations first (cascading doesn't apply cross-table easily)
    db.prepare('DELETE FROM lot_sell_allocations WHERE sell_txn_id IN (SELECT id FROM investment_transactions WHERE user_id = ?)').run(userId);
    db.prepare('DELETE FROM investment_lots WHERE investment_id IN (SELECT id FROM investments WHERE user_id = ?)').run(userId);
    const result = db.prepare('DELETE FROM investment_transactions WHERE user_id = ?').run(userId);
    return result.changes;
  }
  db.prepare('DELETE FROM lot_sell_allocations').run();
  db.prepare('DELETE FROM investment_lots').run();
  const result = db.prepare('DELETE FROM investment_transactions').run();
  return result.changes;
}

// Get sell allocations for a sell transaction (for tax calculation)
export function getSellAllocations(sellTxnId: number): any[] {
  const db = getDb();
  return db.prepare(
    `SELECT sa.*, l.buy_date FROM lot_sell_allocations sa JOIN investment_lots l ON sa.lot_id = l.id WHERE sa.sell_txn_id = ?`
  ).all(sellTxnId);
}
