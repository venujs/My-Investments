import { getDb } from '../db/connection.js';
import type { Investment } from 'shared';

const DETAIL_TABLES: Record<string, string> = {
  fd: 'investment_fd',
  rd: 'investment_rd',
  mf_equity: 'investment_mf',
  mf_hybrid: 'investment_mf',
  mf_debt: 'investment_mf',
  shares: 'investment_shares',
  gold: 'investment_gold',
  loan: 'investment_loan',
  fixed_asset: 'investment_fixed_asset',
  pension: 'investment_pension',
  savings_account: 'investment_savings_account',
};

function getDetailTable(investmentType: string): string {
  return DETAIL_TABLES[investmentType] || '';
}

export function getAllInvestments(userId?: number): Investment[] {
  const db = getDb();
  let sql = `SELECT i.*, u.name as user_name FROM investments i JOIN users u ON i.user_id = u.id`;
  const params: any[] = [];
  if (userId) {
    sql += ' WHERE i.user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY i.created_at DESC';
  const investments = db.prepare(sql).all(...params) as Investment[];

  // Attach detail for each
  for (const inv of investments) {
    inv.detail = getDetail(inv.id, inv.investment_type);
    inv.is_active = !!inv.is_active;
  }
  return investments;
}

export function getInvestmentsByType(investmentType: string, userId?: number): Investment[] {
  const db = getDb();
  let sql = `SELECT i.*, u.name as user_name FROM investments i JOIN users u ON i.user_id = u.id WHERE i.investment_type = ?`;
  const params: any[] = [investmentType];
  if (userId) {
    sql += ' AND i.user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY i.created_at DESC';
  const investments = db.prepare(sql).all(...params) as Investment[];
  for (const inv of investments) {
    inv.detail = getDetail(inv.id, inv.investment_type);
    inv.is_active = !!inv.is_active;
  }
  return investments;
}

export function getInvestmentById(id: number): Investment | undefined {
  const db = getDb();
  const inv = db.prepare(
    `SELECT i.*, u.name as user_name FROM investments i JOIN users u ON i.user_id = u.id WHERE i.id = ?`
  ).get(id) as Investment | undefined;
  if (!inv) return undefined;
  inv.detail = getDetail(inv.id, inv.investment_type);
  inv.is_active = !!inv.is_active;
  return inv;
}

function getDetail(investmentId: number, investmentType: string): Record<string, any> | undefined {
  const db = getDb();
  const table = getDetailTable(investmentType);
  if (!table) return undefined;
  return db.prepare(`SELECT * FROM ${table} WHERE investment_id = ?`).get(investmentId) as Record<string, any> | undefined;
}

export function createInvestment(
  userId: number,
  base: { investment_type: string; name: string; institution?: string | null; notes?: string | null; is_active?: boolean },
  detail: Record<string, any>
): Investment {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO investments (user_id, investment_type, name, institution, notes, is_active) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, base.investment_type, base.name, base.institution || null, base.notes || null, base.is_active !== false ? 1 : 0);
  const investmentId = Number(result.lastInsertRowid);

  // Insert detail
  const table = getDetailTable(base.investment_type);
  if (table && detail) {
    const detailWithId: Record<string, any> = { investment_id: investmentId, ...detail };
    const cols = Object.keys(detailWithId);
    const placeholders = cols.map(() => '?').join(', ');
    const vals = cols.map(c => detailWithId[c]);
    db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
  }

  return getInvestmentById(investmentId)!;
}

export function updateInvestment(
  id: number,
  base: { name?: string; institution?: string | null; notes?: string | null; is_active?: boolean },
  detail?: Record<string, any>
): Investment | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (base.name !== undefined) { fields.push('name = ?'); values.push(base.name); }
  if (base.institution !== undefined) { fields.push('institution = ?'); values.push(base.institution); }
  if (base.notes !== undefined) { fields.push('notes = ?'); values.push(base.notes); }
  if (base.is_active !== undefined) { fields.push('is_active = ?'); values.push(base.is_active ? 1 : 0); }
  fields.push("updated_at = datetime('now')");
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE investments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  // Update detail if provided
  if (detail) {
    const inv = db.prepare('SELECT investment_type FROM investments WHERE id = ?').get(id) as { investment_type: string } | undefined;
    if (inv) {
      const table = getDetailTable(inv.investment_type);
      if (table) {
        const detailFields = Object.keys(detail).filter(k => k !== 'investment_id');
        if (detailFields.length > 0) {
          const setClauses = detailFields.map(f => `${f} = ?`).join(', ');
          const setValues = detailFields.map(f => detail[f]);
          setValues.push(id);
          db.prepare(`UPDATE ${table} SET ${setClauses} WHERE investment_id = ?`).run(...setValues);
        }
      }
    }
  }

  return getInvestmentById(id);
}

export function updateGoldWeight(investmentId: number, deltaGrams: number): void {
  const db = getDb();
  db.prepare('UPDATE investment_gold SET weight_grams = weight_grams + ? WHERE investment_id = ?').run(deltaGrams, investmentId);
}

export function deleteInvestment(id: number): boolean {
  const db = getDb();
  // Detail tables cascade delete
  const result = db.prepare('DELETE FROM investments WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteAllInvestments(userId?: number): number {
  const db = getDb();
  if (userId) {
    const result = db.prepare('DELETE FROM investments WHERE user_id = ?').run(userId);
    return result.changes;
  }
  const result = db.prepare('DELETE FROM investments').run();
  return result.changes;
}

export function addOverride(investmentId: number, userId: number, overrideDate: string, valuePaise: number, reason: string | null): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO investment_overrides (investment_id, override_date, value_paise, reason, user_id) VALUES (?, ?, ?, ?, ?)'
  ).run(investmentId, overrideDate, valuePaise, reason, userId);
}

export function getOverrides(investmentId: number): any[] {
  const db = getDb();
  return db.prepare('SELECT * FROM investment_overrides WHERE investment_id = ? ORDER BY override_date DESC').all(investmentId);
}

export function getLatestOverride(investmentId: number): any | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM investment_overrides WHERE investment_id = ? ORDER BY override_date DESC LIMIT 1').get(investmentId);
}
