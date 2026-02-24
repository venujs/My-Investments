import { getDb } from '../db/connection.js';
import { currentYearMonth, today } from '../utils/date.js';
import * as investmentService from './investmentService.js';
import * as transactionService from './transactionService.js';
import * as valuationService from './valuationService.js';
import * as goalService from './goalService.js';
import * as calc from './calculationService.js';
import { fetchMFNavForDate, fetchStockPriceForDate } from './marketDataService.js';
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

  // Compute current goal values
  const goalsSnapshot: Record<string, { name: string; value: number; target: number; progress: number }> = {};
  try {
    const goals = goalService.getAllGoals(userId);
    for (const goal of goals) {
      goalsSnapshot[String(goal.id)] = {
        name: goal.name,
        value: goal.current_value_paise || 0,
        target: goal.target_amount_paise,
        progress: goal.progress_percent || 0,
      };
    }
  } catch { /* non-critical */ }

  db.prepare(
    `INSERT OR REPLACE INTO net_worth_snapshots (user_id, year_month, total_invested_paise, total_value_paise, total_debt_paise, net_worth_paise, breakdown_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, ym, totalInvested, totalValue, totalDebt, netWorth, JSON.stringify({ ...breakdown, _goals: goalsSnapshot }));
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

  let invested = transactionService.getTotalInvestedAsOf(investment.id, targetDate);

  // Fallback: for instruments with no transaction records, derive invested from detail fields
  if (invested === 0 && detail) {
    switch (investment.investment_type) {
      case 'fd':
        invested = detail.principal_paise || 0;
        break;
      case 'rd': {
        const rdEnd = new Date(targetDate);
        const rdStart = new Date(detail.start_date);
        if (rdEnd >= rdStart) {
          let monthsPaid = 0;
          const d = new Date(rdStart);
          while (d <= rdEnd) { monthsPaid++; d.setMonth(d.getMonth() + 1); }
          invested = (detail.monthly_installment_paise || 0) * monthsPaid;
        }
        break;
      }
      case 'fixed_asset':
        invested = detail.purchase_price_paise || 0;
        break;
      case 'gold':
        if (detail.weight_grams && detail.purchase_price_per_gram_paise) {
          invested = Math.round(detail.weight_grams * detail.purchase_price_per_gram_paise);
        }
        break;
      case 'loan':
        invested = detail.principal_paise || 0;
        break;
    }
  }

  if (override) {
    return { invested, value: override.value_paise };
  }

  let value = 0;
  switch (investment.investment_type) {
    case 'fd': {
      // Cap at maturity date — value stops growing once the FD matures
      const fdEffectiveDate = detail.maturity_date && detail.maturity_date < targetDate
        ? detail.maturity_date
        : targetDate;
      value = calc.calculateFDValue(detail.principal_paise, detail.interest_rate, detail.compounding, detail.start_date, fdEffectiveDate);
      break;
    }
    case 'rd': {
      // Cap at maturity date — value stops growing once the RD matures
      const rdEffectiveDate = detail.maturity_date && detail.maturity_date < targetDate
        ? detail.maturity_date
        : targetDate;
      value = calc.calculateRDValue(detail.monthly_installment_paise, detail.interest_rate, detail.compounding, detail.start_date, rdEffectiveDate);
      break;
    }
    case 'mf_equity':
    case 'mf_hybrid':
    case 'mf_debt': {
      const units = transactionService.getTotalUnitsAsOf(investment.id, targetDate);
      if (units > 0 && detail.isin_code) {
        const navData = await fetchMFNavForDate(detail.scheme_code || detail.isin_code, targetDate);
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
      if (!detail.weight_grams) break;
      const purity = detail.purity || '24K';

      // 1. Use actual gold price from gold_prices table at or before targetDate (most accurate)
      const historicalGoldRow = db.prepare(
        `SELECT price_per_gram_paise, date FROM gold_prices WHERE date <= ? ORDER BY date DESC LIMIT 1`
      ).get(targetDate) as { price_per_gram_paise: number; date: string } | undefined;

      if (historicalGoldRow) {
        value = calc.calculateGoldValue(detail.weight_grams, purity, historicalGoldRow.price_per_gram_paise);
      } else {
        // Ensure goldRate is always a valid positive number — parseFloat can return NaN for
        // invalid settings values, and NaN propagates through all arithmetic producing NaN
        // for value, which then corrupts totalValue via totalValue += NaN.
        const rateRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('rate_gold') as { value: string } | undefined;
        const goldRateParsed = rateRow ? parseFloat(rateRow.value) : NaN;
        const goldRate = (isNaN(goldRateParsed) || goldRateParsed <= 0) ? 8 : goldRateParsed;

        // 2. Back-extrapolate from the most recent gold price we have (preferred: anchored to real market)
        const latestGoldRow = db.prepare(
          `SELECT price_per_gram_paise, date FROM gold_prices ORDER BY date DESC LIMIT 1`
        ).get() as { price_per_gram_paise: number; date: string } | undefined;

        if (latestGoldRow) {
          const yearsBack = Math.max(0, (new Date(latestGoldRow.date).getTime() - new Date(targetDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
          const estimatedPrice = Math.round(latestGoldRow.price_per_gram_paise / Math.pow(1 + goldRate / 100, yearsBack));
          value = calc.calculateGoldValue(detail.weight_grams, purity, Math.max(1, estimatedPrice));
        } else if (detail.purchase_price_per_gram_paise > 0) {
          // 3. Appreciate from purchase price using the gold appreciation rate setting
          const purchaseDate = detail.purchase_date || targetDate;
          const yearsElapsed = Math.max(0, (new Date(targetDate).getTime() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
          const purityFactor = purity === '24K' ? 1.0 : purity === '22K' ? 22 / 24 : 18 / 24;
          const purchaseTotal = Math.round(detail.weight_grams * detail.purchase_price_per_gram_paise * purityFactor);
          value = Math.round(purchaseTotal * Math.pow(1 + goldRate / 100, yearsElapsed));
        }
        // If no gold price data at all: value stays 0 (user must fetch prices or enter purchase price)
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

  // Guard against NaN: Math.max(0, NaN) = NaN, but NaN || 0 = 0
  return { invested: Math.max(0, invested || 0), value: Math.max(0, value || 0) };
}

// Build historical cashflows for XIRR calculation up to a given target date
function buildHistoricalCashflows(investment: Investment, targetDate: string): { date: string; amount: number }[] {
  const db = getDb();
  const txns = db.prepare(
    `SELECT txn_type, date, amount_paise FROM investment_transactions WHERE investment_id = ? AND date <= ? ORDER BY date ASC`
  ).all(investment.id, targetDate) as { txn_type: string; date: string; amount_paise: number }[];

  if (txns.length > 0) {
    return txns.map(t => ({
      date: t.date,
      amount: ['buy', 'sip', 'deposit', 'premium'].includes(t.txn_type) ? -t.amount_paise : t.amount_paise,
    }));
  }

  // Synthetic fallback for instruments with no transaction records
  const detail = investment.detail;
  if (!detail) return [];
  const cashflows: { date: string; amount: number }[] = [];
  switch (investment.investment_type) {
    case 'fd':
      if (detail.principal_paise && detail.start_date && detail.start_date <= targetDate)
        cashflows.push({ date: detail.start_date, amount: -detail.principal_paise });
      break;
    case 'rd':
      if (detail.monthly_installment_paise && detail.start_date) {
        const d = new Date(detail.start_date);
        const end = new Date(targetDate);
        while (d <= end) {
          cashflows.push({ date: d.toISOString().split('T')[0], amount: -detail.monthly_installment_paise });
          d.setMonth(d.getMonth() + 1);
        }
      }
      break;
    case 'fixed_asset':
      if (detail.purchase_price_paise && detail.purchase_date && detail.purchase_date <= targetDate)
        cashflows.push({ date: detail.purchase_date, amount: -detail.purchase_price_paise });
      break;
    case 'gold':
      if (detail.weight_grams && detail.purchase_price_per_gram_paise) {
        const pd = detail.purchase_date || targetDate;
        if (pd <= targetDate)
          cashflows.push({ date: pd, amount: -Math.round(detail.weight_grams * detail.purchase_price_per_gram_paise) });
      }
      break;
  }
  return cashflows;
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

  // Delete existing snapshots for all target months before regenerating
  const ymArr = Array.from(targetMonths);
  const ph = ymArr.map(() => '?').join(',');
  db.prepare(
    `DELETE FROM monthly_snapshots WHERE year_month IN (${ph}) AND investment_id IN (SELECT id FROM investments WHERE user_id = ?)`
  ).run(...ymArr, userId);
  db.prepare(
    `DELETE FROM net_worth_snapshots WHERE user_id = ? AND year_month IN (${ph})`
  ).run(userId, ...ymArr);

  const sortedMonths = ymArr.sort();
  let processed = 0;

  // Fetch investments once outside the loop — they don't change between months
  const investments = investmentService.getAllInvestments(userId);

  // Pre-compute the first transaction date per investment in one batch query.
  // Used as the effective start date for MF, shares, pension, savings_account
  // (whose detail records have no start_date / purchase_date field).
  const firstTxnDateMap = new Map<number, string>();
  if (investments.length > 0) {
    const invIds = investments.map(i => i.id);
    const phInv = invIds.map(() => '?').join(',');
    (db.prepare(
      `SELECT investment_id, MIN(date) as first_date FROM investment_transactions WHERE investment_id IN (${phInv}) GROUP BY investment_id`
    ).all(...invIds) as { investment_id: number; first_date: string }[])
      .forEach(r => firstTxnDateMap.set(r.investment_id, r.first_date));
  }

  for (const ym of sortedMonths) {
    // Target date is the 1st of the month (user spec: "values on 1st day of the month")
    const targetDate = `${ym}-01`;

    // Filter to investments that actually existed at targetDate.
    // Use the investment's real financial start date, NOT the DB created_at timestamp
    // (created_at is when the record was entered, which is often much later than the actual start).
    const activeInvestments = investments.filter(inv => {
      const detail = inv.detail;
      const createdDate = inv.created_at ? inv.created_at.split('T')[0].split(' ')[0] : todayStr;
      let startDate: string;
      switch (inv.investment_type) {
        case 'fd':
        case 'rd':
        case 'loan':
          startDate = detail?.start_date || createdDate;
          break;
        case 'gold':
        case 'fixed_asset':
          startDate = detail?.purchase_date || createdDate;
          break;
        default:
          // mf_equity, mf_hybrid, mf_debt, shares, pension, savings_account:
          // use first transaction date; fall back to created_at if no transactions yet
          startDate = firstTxnDateMap.get(inv.id) || createdDate;
      }
      return startDate <= targetDate;
    });

    const breakdown: Record<string, { invested: number; value: number; count: number; gain: number; gain_percent: number; xirr: number | null }> = {};

    for (const inv of activeInvestments) {
      let invested = 0;
      let value = 0;
      try {
        ({ invested, value } = await calculateHistoricalValue(inv, targetDate));
      } catch (err) {
        console.error(`calculateHistoricalValue failed for investment ${inv.id} (${inv.name}) at ${targetDate}:`, err);
        // Skip this investment rather than corrupting the totals
        await new Promise<void>(resolve => setImmediate(resolve));
        continue;
      }

      // Store individual investment snapshot
      db.prepare(
        `INSERT OR REPLACE INTO monthly_snapshots (investment_id, year_month, invested_paise, current_value_paise, gain_paise)
         VALUES (?, ?, ?, ?, ?)`
      ).run(inv.id, ym, invested, value, value - invested);

      if (!breakdown[inv.investment_type]) {
        breakdown[inv.investment_type] = { invested: 0, value: 0, count: 0, gain: 0, gain_percent: 0, xirr: null };
      }
      breakdown[inv.investment_type].invested += invested;
      breakdown[inv.investment_type].value += value;
      breakdown[inv.investment_type].count += 1;

      // Yield after every investment so HTTP requests can be served
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    // Recompute totals from breakdown — more reliable than accumulating in the loop
    // because if any investment returned NaN (stored as 0 in the breakdown object),
    // that NaN would have corrupted a running totalValue via += NaN.
    let totalInvested = 0;
    let totalValue = 0;
    let totalDebt = 0;
    for (const [type, bkd] of Object.entries(breakdown)) {
      if (type === 'loan') {
        totalDebt += bkd.value || 0;
      } else {
        totalInvested += bkd.invested || 0;
        totalValue += bkd.value || 0;
      }
    }

    // Compute gain, gain_percent, and XIRR per investment type
    for (const type of Object.keys(breakdown)) {
      const bkd = breakdown[type];
      if (type === 'loan') {
        bkd.gain = 0;
        bkd.gain_percent = 0;
        bkd.xirr = null;
        continue;
      }
      bkd.gain = bkd.value - bkd.invested;
      bkd.gain_percent = bkd.invested > 0 ? ((bkd.value - bkd.invested) / bkd.invested) * 100 : 0;

      const typeInvs = activeInvestments.filter(inv => inv.investment_type === type);
      const cashflows: { date: string; amount: number }[] = [];
      for (const inv of typeInvs) {
        cashflows.push(...buildHistoricalCashflows(inv, targetDate));
      }
      if (cashflows.length > 0 && bkd.value > 0) {
        cashflows.sort((a, b) => a.date.localeCompare(b.date));
        cashflows.push({ date: targetDate, amount: bkd.value });
        const xirr = calc.calculateXIRR(cashflows);
        bkd.xirr = xirr !== null ? Math.round(xirr * 10000) / 100 : null;
      } else {
        bkd.xirr = null;
      }

      // Yield after each XIRR computation (Newton-Raphson is CPU-intensive)
      await new Promise<void>(resolve => setImmediate(resolve));
    }

    const netWorth = totalValue - totalDebt;

    // Compute historical goal values using just-inserted monthly_snapshots
    const histGoals: Record<string, { name: string; value: number; target: number; progress: number }> = {};
    const userGoals = db.prepare(
      `SELECT id, name, target_amount_paise FROM goals WHERE user_id = ?`
    ).all(userId) as { id: number; name: string; target_amount_paise: number }[];
    for (const goal of userGoals) {
      const gis = db.prepare(
        `SELECT gi.investment_id, gi.allocation_percent, i.investment_type
         FROM goal_investments gi
         JOIN investments i ON gi.investment_id = i.id
         WHERE gi.goal_id = ?`
      ).all(goal.id) as { investment_id: number; allocation_percent: number; investment_type: string }[];
      let goalValue = 0;
      for (const gi of gis) {
        const snap = db.prepare(
          `SELECT current_value_paise FROM monthly_snapshots WHERE investment_id = ? AND year_month = ?`
        ).get(gi.investment_id, ym) as { current_value_paise: number } | undefined;
        if (snap) {
          const contribution = Math.round(snap.current_value_paise * (gi.allocation_percent / 100));
          if (gi.investment_type === 'loan') goalValue -= contribution;
          else goalValue += contribution;
        }
      }
      const progress = goal.target_amount_paise > 0 ? (goalValue / goal.target_amount_paise) * 100 : 0;
      histGoals[String(goal.id)] = { name: goal.name, value: goalValue, target: goal.target_amount_paise, progress };
    }

    db.prepare(
      `INSERT OR REPLACE INTO net_worth_snapshots (user_id, year_month, total_invested_paise, total_value_paise, total_debt_paise, net_worth_paise, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, ym, totalInvested, totalValue, totalDebt, netWorth, JSON.stringify({ ...breakdown, _goals: histGoals }));

    processed++;
    // Yield the event loop so HTTP requests can be processed between months
    await new Promise<void>(resolve => setImmediate(resolve));
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
