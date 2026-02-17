import { getDb } from '../db/connection.js';
import { currentYearMonth, today } from '../utils/date.js';
import * as investmentService from './investmentService.js';
import * as transactionService from './transactionService.js';
import * as valuationService from './valuationService.js';
import * as calc from './calculationService.js';
import { getCachedPriceForDate, getCachedGoldPriceForDate, fetchMFNavForDate, fetchStockPriceForDate } from './marketDataService.js';
import type { DashboardStats, InvestmentBreakdown, Investment } from 'shared';
import { InvestmentTypeLabels } from 'shared';

export function calculateMonthlySnapshots(yearMonth?: string): number {
  const db = getDb();
  const ym = yearMonth || currentYearMonth();
  const investments = investmentService.getAllInvestments();
  let count = 0;

  for (const inv of investments) {
    const enriched = valuationService.enrichInvestment(inv);
    const invested = enriched.invested_amount_paise || 0;
    const currentValue = enriched.current_value_paise || 0;
    const gain = currentValue - invested;

    db.prepare(
      `INSERT OR REPLACE INTO monthly_snapshots (investment_id, year_month, invested_paise, current_value_paise, gain_paise)
       VALUES (?, ?, ?, ?, ?)`
    ).run(inv.id, ym, invested, currentValue, gain);
    count++;
  }

  return count;
}

export function calculateNetWorthSnapshot(userId: number, yearMonth?: string): void {
  const db = getDb();
  const ym = yearMonth || currentYearMonth();
  const investments = investmentService.getAllInvestments(userId);

  let totalInvested = 0;
  let totalValue = 0;
  let totalDebt = 0;
  const breakdown: Record<string, { invested: number; value: number; count: number }> = {};

  for (const inv of investments) {
    const enriched = valuationService.enrichInvestment(inv);
    const invested = enriched.invested_amount_paise || 0;
    const currentValue = enriched.current_value_paise || 0;

    if (inv.investment_type === 'loan') {
      totalDebt += currentValue;
    } else {
      totalInvested += invested;
      totalValue += currentValue;
    }

    if (!breakdown[inv.investment_type]) {
      breakdown[inv.investment_type] = { invested: 0, value: 0, count: 0 };
    }
    breakdown[inv.investment_type].invested += invested;
    breakdown[inv.investment_type].value += currentValue;
    breakdown[inv.investment_type].count += 1;
  }

  const netWorth = totalValue - totalDebt;

  db.prepare(
    `INSERT OR REPLACE INTO net_worth_snapshots (user_id, year_month, total_invested_paise, total_value_paise, total_debt_paise, net_worth_paise, breakdown_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, ym, totalInvested, totalValue, totalDebt, netWorth, JSON.stringify(breakdown));
}

export function getNetWorthHistory(userId: number): any[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM net_worth_snapshots WHERE user_id = ? ORDER BY year_month ASC`
  ).all(userId);
}

export function getDashboardStats(userId?: number): DashboardStats {
  const investments = investmentService.getAllInvestments(userId);
  let totalInvested = 0;
  let totalValue = 0;
  let totalDebt = 0;
  let count = 0;

  for (const inv of investments) {
    const enriched = valuationService.enrichInvestment(inv);
    if (inv.investment_type === 'loan') {
      totalDebt += enriched.current_value_paise || 0;
    } else {
      totalInvested += enriched.invested_amount_paise || 0;
      totalValue += enriched.current_value_paise || 0;
    }
    count++;
  }

  return {
    total_invested_paise: totalInvested,
    total_current_value_paise: totalValue,
    total_gain_paise: totalValue - totalInvested,
    total_gain_percent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    total_debt_paise: totalDebt,
    net_worth_paise: totalValue - totalDebt,
    investment_count: count,
  };
}

export function getInvestmentBreakdown(userId?: number): InvestmentBreakdown[] {
  const investments = investmentService.getAllInvestments(userId);
  const map: Record<string, InvestmentBreakdown> = {};

  for (const inv of investments) {
    const enriched = valuationService.enrichInvestment(inv);
    const type = inv.investment_type;
    if (!map[type]) {
      map[type] = {
        investment_type: type as any,
        label: (InvestmentTypeLabels as any)[type] || type,
        invested_paise: 0,
        current_value_paise: 0,
        count: 0,
      };
    }
    map[type].invested_paise += enriched.invested_amount_paise || 0;
    map[type].current_value_paise += enriched.current_value_paise || 0;
    map[type].count += 1;
  }

  return Object.values(map);
}

export function getTypeHistory(userId: number, investmentType: string): { month: string; invested: number; value: number }[] {
  const db = getDb();
  const snapshots = db.prepare(
    `SELECT year_month, breakdown_json FROM net_worth_snapshots WHERE user_id = ? ORDER BY year_month ASC`
  ).all(userId) as { year_month: string; breakdown_json: string }[];

  const result: { month: string; invested: number; value: number }[] = [];
  for (const s of snapshots) {
    try {
      const breakdown = JSON.parse(s.breakdown_json) as Record<string, { invested: number; value: number; count: number }>;
      const typeData = breakdown[investmentType];
      if (typeData) {
        result.push({ month: s.year_month, invested: typeData.invested, value: typeData.value });
      }
    } catch { /* skip malformed */ }
  }
  return result;
}

// Calculate historical value of a single investment at a given date
async function calculateHistoricalValue(investment: Investment, targetDate: string): Promise<{ invested: number; value: number }> {
  const detail = investment.detail;
  if (!detail) return { invested: 0, value: 0 };

  // Check for manual override at or before this date
  const db = getDb();
  const override = db.prepare(
    `SELECT value_paise FROM investment_overrides WHERE investment_id = ? AND override_date <= ? ORDER BY override_date DESC LIMIT 1`
  ).get(investment.id, targetDate) as { value_paise: number } | undefined;

  const invested = transactionService.getTotalInvestedAsOf(investment.id, targetDate);

  if (override) {
    return { invested, value: override.value_paise };
  }

  let value = 0;
  switch (investment.investment_type) {
    case 'fd':
      value = calc.calculateFDValue(detail.principal_paise, detail.interest_rate, detail.compounding, detail.start_date, targetDate);
      break;
    case 'rd':
      value = calc.calculateRDValue(detail.monthly_installment_paise, detail.interest_rate, detail.compounding, detail.start_date, targetDate);
      break;
    case 'mf_equity':
    case 'mf_hybrid':
    case 'mf_debt': {
      const units = transactionService.getTotalUnitsAsOf(investment.id, targetDate);
      if (units > 0 && detail.amfi_code) {
        const navData = await fetchMFNavForDate(detail.amfi_code, targetDate);
        if (navData) {
          value = Math.round(units * navData.pricePaise);
        }
      }
      break;
    }
    case 'shares': {
      const units = transactionService.getTotalUnitsAsOf(investment.id, targetDate);
      if (units > 0 && detail.ticker_symbol) {
        const priceData = await fetchStockPriceForDate(detail.ticker_symbol, detail.exchange || 'NSE', targetDate);
        if (priceData) {
          value = Math.round(units * priceData.pricePaise);
        }
      }
      break;
    }
    case 'gold': {
      const goldPrice = getCachedGoldPriceForDate(targetDate);
      if (goldPrice) {
        const purityFactor = detail.purity === '24K' ? 1.0 : detail.purity === '22K' ? 22 / 24 : 18 / 24;
        value = Math.round(detail.weight_grams * goldPrice.price_per_gram_paise * purityFactor);
      }
      break;
    }
    case 'loan':
      value = calc.calculateLoanOutstanding(detail.principal_paise, detail.interest_rate, detail.emi_paise, detail.start_date, targetDate);
      break;
    case 'fixed_asset':
      value = calc.calculateAssetValue(detail.purchase_price_paise, detail.inflation_rate, detail.purchase_date, targetDate);
      break;
    case 'pension': {
      const totalDeposits = transactionService.getTotalInvestedAsOf(investment.id, targetDate);
      if (totalDeposits > 0) {
        const txns = transactionService.getTransactions(investment.id);
        const firstDate = txns.length > 0 ? txns[txns.length - 1].date : targetDate;
        value = calc.calculatePensionValue(totalDeposits, detail.interest_rate, firstDate, targetDate);
      }
      break;
    }
    case 'savings_account':
      value = transactionService.getTotalInvestedAsOf(investment.id, targetDate);
      break;
    default:
      value = invested;
  }

  return { invested: Math.max(0, invested), value: Math.max(0, value) };
}

// Generate historical snapshots for last 36 months + last 10 years
export async function generateHistoricalSnapshots(userId: number): Promise<number> {
  const db = getDb();
  const todayStr = today();
  const now = new Date(todayStr);

  // Build target months: last 36 monthly + last 10 yearly (Jan 1)
  const targetMonths = new Set<string>();

  // Last 36 months
  for (let i = 1; i <= 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    targetMonths.add(ym);
  }

  // Last 10 years (January)
  for (let i = 1; i <= 10; i++) {
    const year = now.getFullYear() - i;
    targetMonths.add(`${year}-01`);
  }

  const sortedMonths = Array.from(targetMonths).sort();
  let processed = 0;

  for (const ym of sortedMonths) {
    // Target date is last day of the month
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const targetDate = `${ym}-${String(lastDay).padStart(2, '0')}`;

    // Get all investments that existed at this date
    const investments = investmentService.getAllInvestments(userId);
    const activeInvestments = investments.filter(inv => {
      const createdDate = inv.created_at ? inv.created_at.split('T')[0].split(' ')[0] : todayStr;
      return createdDate <= targetDate;
    });

    let totalInvested = 0;
    let totalValue = 0;
    let totalDebt = 0;
    const breakdown: Record<string, { invested: number; value: number; count: number }> = {};

    for (const inv of activeInvestments) {
      const { invested, value } = await calculateHistoricalValue(inv, targetDate);

      // Store individual investment snapshot
      db.prepare(
        `INSERT OR REPLACE INTO monthly_snapshots (investment_id, year_month, invested_paise, current_value_paise, gain_paise)
         VALUES (?, ?, ?, ?, ?)`
      ).run(inv.id, ym, invested, value, value - invested);

      if (inv.investment_type === 'loan') {
        totalDebt += value;
      } else {
        totalInvested += invested;
        totalValue += value;
      }

      if (!breakdown[inv.investment_type]) {
        breakdown[inv.investment_type] = { invested: 0, value: 0, count: 0 };
      }
      breakdown[inv.investment_type].invested += invested;
      breakdown[inv.investment_type].value += value;
      breakdown[inv.investment_type].count += 1;
    }

    const netWorth = totalValue - totalDebt;
    db.prepare(
      `INSERT OR REPLACE INTO net_worth_snapshots (user_id, year_month, total_invested_paise, total_value_paise, total_debt_paise, net_worth_paise, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, ym, totalInvested, totalValue, totalDebt, netWorth, JSON.stringify(breakdown));

    processed++;
  }

  return processed;
}

// Get list of all snapshots
export function getSnapshotList(userId: number): any[] {
  const db = getDb();
  return db.prepare(
    `SELECT year_month, total_invested_paise, total_value_paise, total_debt_paise, net_worth_paise, breakdown_json
     FROM net_worth_snapshots WHERE user_id = ? ORDER BY year_month DESC`
  ).all(userId);
}

// Get snapshot detail for a specific month
export function getSnapshotDetail(userId: number, yearMonth: string): any[] {
  const db = getDb();
  return db.prepare(
    `SELECT ms.investment_id, ms.invested_paise, ms.current_value_paise, ms.gain_paise,
            i.name as investment_name, i.investment_type
     FROM monthly_snapshots ms
     JOIN investments i ON ms.investment_id = i.id
     WHERE ms.year_month = ? AND i.user_id = ?
     ORDER BY i.investment_type, i.name`
  ).all(yearMonth, userId);
}

export function clearSnapshots(): void {
  const db = getDb();
  db.prepare('DELETE FROM monthly_snapshots').run();
  db.prepare('DELETE FROM net_worth_snapshots').run();
}
