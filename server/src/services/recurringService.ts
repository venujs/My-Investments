import { getDb } from '../db/connection.js';
import { today, addDays, addMonths, addYears } from '../utils/date.js';
import * as transactionService from './transactionService.js';
import { fetchMFNavForDate, fetchStockPriceForDate, fetchStockPrice } from './marketDataService.js';
import type { InvestmentRecurringRule } from 'shared';

export function getAllRules(userId?: number): InvestmentRecurringRule[] {
  const db = getDb();
  let sql = `SELECT r.*, i.name as investment_name, i.investment_type, mf.folio_number, mf.scheme_name
     FROM recurring_rules r
     JOIN investments i ON r.investment_id = i.id
     LEFT JOIN investment_mf mf ON i.id = mf.investment_id`;
  const params: any[] = [];
  if (userId) {
    sql += ' WHERE r.user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY r.created_at DESC';
  const rules = db.prepare(sql).all(...params) as InvestmentRecurringRule[];
  rules.forEach(r => { r.is_active = !!r.is_active; });
  return rules;
}

export function getRuleById(id: number): InvestmentRecurringRule | undefined {
  const db = getDb();
  const rule = db.prepare(
    `SELECT r.*, i.name as investment_name, i.investment_type, mf.folio_number, mf.scheme_name
     FROM recurring_rules r
     JOIN investments i ON r.investment_id = i.id
     LEFT JOIN investment_mf mf ON i.id = mf.investment_id
     WHERE r.id = ?`
  ).get(id) as InvestmentRecurringRule | undefined;
  if (rule) rule.is_active = !!rule.is_active;
  return rule;
}

export async function createRule(
  userId: number,
  data: {
    investment_id: number;
    txn_type: string;
    amount_paise: number;
    frequency: string;
    day_of_month?: number | null;
    start_date: string;
    end_date?: string | null;
    is_active?: boolean;
  }
): Promise<InvestmentRecurringRule> {
  const db = getDb();

  // Validate shares can be priced before creating rule
  const inv = db.prepare(
    `SELECT i.investment_type, s.ticker_symbol, s.exchange FROM investments i LEFT JOIN investment_shares s ON i.id = s.investment_id WHERE i.id = ?`
  ).get(data.investment_id) as { investment_type: string; ticker_symbol?: string; exchange?: string } | undefined;
  if (inv && inv.investment_type === 'shares' && inv.ticker_symbol) {
    const price = await fetchStockPrice(inv.ticker_symbol, inv.exchange || 'NSE');
    if (!price) {
      throw new Error(`Cannot create recurring rule: price unavailable for ${inv.ticker_symbol} on ${inv.exchange || 'NSE'}`);
    }
  }

  const result = db.prepare(
    `INSERT INTO recurring_rules (investment_id, user_id, txn_type, amount_paise, frequency, day_of_month, start_date, end_date, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.investment_id, userId, data.txn_type, data.amount_paise,
    data.frequency, data.day_of_month ?? null, data.start_date,
    data.end_date ?? null, data.is_active !== false ? 1 : 0
  );
  return getRuleById(Number(result.lastInsertRowid))!;
}

export function updateRule(id: number, data: Partial<{
  txn_type: string; amount_paise: number; frequency: string;
  day_of_month: number | null; start_date: string; end_date: string | null; is_active: boolean;
}>): InvestmentRecurringRule | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (data.txn_type !== undefined) { fields.push('txn_type = ?'); values.push(data.txn_type); }
  if (data.amount_paise !== undefined) { fields.push('amount_paise = ?'); values.push(data.amount_paise); }
  if (data.frequency !== undefined) { fields.push('frequency = ?'); values.push(data.frequency); }
  if (data.day_of_month !== undefined) { fields.push('day_of_month = ?'); values.push(data.day_of_month); }
  if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date); }
  if (data.end_date !== undefined) { fields.push('end_date = ?'); values.push(data.end_date); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }
  if (fields.length === 0) return getRuleById(id);
  values.push(id);
  db.prepare(`UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getRuleById(id);
}

export function deleteRule(id: number): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM recurring_rules WHERE id = ?').run(id).changes > 0;
}

export async function generateRecurringTransactions(): Promise<number> {
  const db = getDb();
  const rules = db.prepare(
    `SELECT r.*, i.user_id as inv_user_id, i.investment_type, mf.amfi_code, s.ticker_symbol, s.exchange
     FROM recurring_rules r
     JOIN investments i ON r.investment_id = i.id
     LEFT JOIN investment_mf mf ON i.id = mf.investment_id
     LEFT JOIN investment_shares s ON i.id = s.investment_id
     WHERE r.is_active = 1`
  ).all() as any[];

  const todayStr = today();
  let generated = 0;

  for (const rule of rules) {
    let nextDate = rule.last_generated
      ? getNextDate(rule.last_generated, rule.frequency, rule.day_of_month)
      : rule.start_date;

    while (nextDate <= todayStr) {
      if (rule.end_date && nextDate > rule.end_date) break;

      const txnData: {
        txn_type: string; date: string; amount_paise: number;
        recurring_rule_id: number; units?: number; price_per_unit_paise?: number;
      } = {
        txn_type: rule.txn_type,
        date: nextDate,
        amount_paise: rule.amount_paise,
        recurring_rule_id: rule.id,
      };

      // For MF investments, fetch date-specific NAV and compute units
      const isMF = ['mf_equity', 'mf_hybrid', 'mf_debt'].includes(rule.investment_type);
      if (isMF && rule.amfi_code) {
        const navData = await fetchMFNavForDate(rule.amfi_code, nextDate);
        if (navData && navData.pricePaise > 0) {
          txnData.units = rule.amount_paise / navData.pricePaise;
          txnData.price_per_unit_paise = navData.pricePaise;
        }
      }

      // For shares, fetch date-specific price and compute units
      if (rule.investment_type === 'shares' && rule.ticker_symbol) {
        const priceData = await fetchStockPriceForDate(rule.ticker_symbol, rule.exchange || 'NSE', nextDate);
        if (priceData && priceData.pricePaise > 0) {
          txnData.units = rule.amount_paise / priceData.pricePaise;
          txnData.price_per_unit_paise = priceData.pricePaise;
        }
      }

      transactionService.createTransaction(rule.investment_id, rule.user_id || rule.inv_user_id, txnData);

      db.prepare('UPDATE recurring_rules SET last_generated = ? WHERE id = ?').run(nextDate, rule.id);
      generated++;

      nextDate = getNextDate(nextDate, rule.frequency, rule.day_of_month);
    }
  }

  return generated;
}

function getNextDate(dateStr: string, frequency: string, dayOfMonth: number | null): string {
  switch (frequency) {
    case 'daily': return addDays(dateStr, 1);
    case 'weekly': return addDays(dateStr, 7);
    case 'monthly': {
      const next = addMonths(dateStr, 1);
      if (dayOfMonth) {
        const d = new Date(next);
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dayOfMonth, maxDay));
        return d.toISOString().split('T')[0];
      }
      return next;
    }
    case 'yearly': return addYears(dateStr, 1);
    default: return addMonths(dateStr, 1);
  }
}
