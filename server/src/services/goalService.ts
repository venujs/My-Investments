import { getDb } from '../db/connection.js';
import type { Goal, GoalInvestment } from 'shared';
import * as valuationService from './valuationService.js';
import * as investmentService from './investmentService.js';
import * as calc from './calculationService.js';
import { yearsBetween, today } from '../utils/date.js';
import * as recurringService from './recurringService.js';

export function getAllGoals(userId?: number): Goal[] {
  const db = getDb();
  let sql = 'SELECT * FROM goals';
  const params: any[] = [];
  if (userId) {
    sql += ' WHERE user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY priority ASC, target_date ASC';
  const goals = db.prepare(sql).all(...params) as Goal[];

  for (const goal of goals) {
    goal.is_active = !!goal.is_active;
    goal.investments = getGoalInvestments(goal.id);
    // Calculate current value (loans are negative)
    let currentValue = 0;
    for (const gi of goal.investments) {
      const allocatedValue = Math.round((gi.current_value_paise || 0) * (gi.allocation_percent / 100));
      if (gi.investment_type === 'loan') {
        currentValue -= allocatedValue;
      } else {
        currentValue += allocatedValue;
      }
    }
    goal.current_value_paise = currentValue;
    goal.progress_percent = goal.target_amount_paise > 0 ? (currentValue / goal.target_amount_paise) * 100 : 0;
  }
  return goals;
}

export function getGoalById(id: number): Goal | undefined {
  const db = getDb();
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal | undefined;
  if (!goal) return undefined;
  goal.is_active = !!goal.is_active;
  goal.investments = getGoalInvestments(goal.id);
  let currentValue = 0;
  for (const gi of goal.investments) {
    const allocatedValue = Math.round((gi.current_value_paise || 0) * (gi.allocation_percent / 100));
    if (gi.investment_type === 'loan') {
      currentValue -= allocatedValue;
    } else {
      currentValue += allocatedValue;
    }
  }
  goal.current_value_paise = currentValue;
  goal.progress_percent = goal.target_amount_paise > 0 ? (currentValue / goal.target_amount_paise) * 100 : 0;
  return goal;
}

function getGoalInvestments(goalId: number): GoalInvestment[] {
  const db = getDb();
  const gis = db.prepare(
    `SELECT gi.*, i.name as investment_name, i.investment_type,
            mf.scheme_name, mf.folio_number
     FROM goal_investments gi
     JOIN investments i ON gi.investment_id = i.id
     LEFT JOIN investment_mf mf ON i.id = mf.investment_id
     WHERE gi.goal_id = ?`
  ).all(goalId) as GoalInvestment[];

  for (const gi of gis) {
    const inv = investmentService.getInvestmentById(gi.investment_id);
    if (inv) {
      const enriched = valuationService.enrichInvestment(inv);
      gi.current_value_paise = enriched.current_value_paise || 0;
    }
  }
  return gis;
}

export function createGoal(userId: number, data: {
  name: string; target_amount_paise: number; target_date: string;
  priority?: number; notes?: string | null; is_active?: boolean;
}): Goal {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO goals (user_id, name, target_amount_paise, target_date, priority, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, data.name, data.target_amount_paise, data.target_date, data.priority || 5, data.notes || null, data.is_active !== false ? 1 : 0);
  return getGoalById(Number(result.lastInsertRowid))!;
}

export function updateGoal(id: number, data: Partial<{
  name: string; target_amount_paise: number; target_date: string;
  priority: number; notes: string | null; is_active: boolean;
}>): Goal | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.target_amount_paise !== undefined) { fields.push('target_amount_paise = ?'); values.push(data.target_amount_paise); }
  if (data.target_date !== undefined) { fields.push('target_date = ?'); values.push(data.target_date); }
  if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active ? 1 : 0); }
  if (fields.length === 0) return getGoalById(id);
  values.push(id);
  db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getGoalById(id);
}

export function deleteGoal(id: number): boolean {
  const db = getDb();
  return db.prepare('DELETE FROM goals WHERE id = ?').run(id).changes > 0;
}

export function assignInvestment(goalId: number, investmentId: number, allocationPercent: number): void {
  const db = getDb();
  // Check if investment is already assigned to another goal
  const existing = db.prepare(
    `SELECT goal_id FROM goal_investments WHERE investment_id = ? AND goal_id != ?`
  ).get(investmentId, goalId) as { goal_id: number } | undefined;
  if (existing) {
    throw new Error(`Investment is already assigned to another goal (Goal #${existing.goal_id}). Unassign it first.`);
  }
  db.prepare(
    `INSERT OR REPLACE INTO goal_investments (goal_id, investment_id, allocation_percent) VALUES (?, ?, ?)`
  ).run(goalId, investmentId, allocationPercent);
}

export function removeInvestment(goalId: number, investmentId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM goal_investments WHERE goal_id = ? AND investment_id = ?').run(goalId, investmentId);
}

export function getGoalHistory(goalId: number): { actual: { month: string; value: number }[]; projected: { month: string; value: number }[]; ideal: { month: string; value: number }[]; target: number } {
  const db = getDb();
  const goal = getGoalById(goalId);
  if (!goal) throw new Error('Goal not found');

  const gis = goal.investments || [];
  const target = goal.target_amount_paise;

  // Get actual monthly values from snapshots
  const monthlyValues: Record<string, number> = {};
  for (const gi of gis) {
    const snapshots = db.prepare(
      `SELECT year_month, current_value_paise FROM monthly_snapshots WHERE investment_id = ? ORDER BY year_month ASC`
    ).all(gi.investment_id) as { year_month: string; current_value_paise: number }[];
    for (const s of snapshots) {
      const weight = gi.allocation_percent / 100;
      const contribution = gi.investment_type === 'loan'
        ? -Math.round(s.current_value_paise * weight)
        : Math.round(s.current_value_paise * weight);
      monthlyValues[s.year_month] = (monthlyValues[s.year_month] || 0) + contribution;
    }
  }

  const actual = Object.entries(monthlyValues)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));

  // Add current month with current value
  const currentMonth = today().slice(0, 7);
  const currentValue = goal.current_value_paise || 0;
  if (!monthlyValues[currentMonth]) {
    actual.push({ month: currentMonth, value: currentValue });
  }

  // Compute weighted average rate from assigned investments
  const rates = getTypeRates();
  let weightedRate = 0;
  let totalWeight = 0;
  for (const gi of gis) {
    const inv = investmentService.getInvestmentById(gi.investment_id);
    if (inv) {
      const rate = getRateForType(inv.investment_type, rates);
      weightedRate += rate * (gi.allocation_percent / 100);
      totalWeight += gi.allocation_percent / 100;
    }
  }
  const annualRate = totalWeight > 0 ? weightedRate / totalWeight : 8;
  const monthlyRate = annualRate / 100 / 12;

  // Determine earliest tracking date from investment transactions or goal creation
  let earliestMonth = currentMonth;
  for (const gi of gis) {
    const firstTxn = db.prepare(
      `SELECT MIN(date) as first_date FROM investment_transactions WHERE investment_id = ?`
    ).get(gi.investment_id) as { first_date: string | null } | undefined;
    if (firstTxn?.first_date) {
      const txnMonth = firstTxn.first_date.slice(0, 7);
      if (txnMonth < earliestMonth) earliestMonth = txnMonth;
    }
  }
  if (actual.length > 0 && actual[0].month < earliestMonth) {
    earliestMonth = actual[0].month;
  }
  const goalRow = db.prepare('SELECT created_at FROM goals WHERE id = ?').get(goalId) as { created_at: string } | undefined;
  const goalCreatedMonth = goalRow?.created_at ? goalRow.created_at.slice(0, 7) : currentMonth;
  if (goalCreatedMonth < earliestMonth) earliestMonth = goalCreatedMonth;

  const targetMonth = goal.target_date.slice(0, 7);

  // Build contributions array with start/end dates
  const contributions: { monthlyAmount: number; startDate: string; endDate: string | null }[] = [];
  for (const gi of gis) {
    const rules = db.prepare(
      `SELECT amount_paise, frequency, start_date, end_date FROM recurring_rules WHERE investment_id = ? AND is_active = 1`
    ).all(gi.investment_id) as { amount_paise: number; frequency: string; start_date: string; end_date: string | null }[];
    for (const rule of rules) {
      let monthlyAmount = 0;
      switch (rule.frequency) {
        case 'daily': monthlyAmount = rule.amount_paise * 30; break;
        case 'weekly': monthlyAmount = Math.round(rule.amount_paise * 4.33); break;
        case 'monthly': monthlyAmount = rule.amount_paise; break;
        case 'yearly': monthlyAmount = Math.round(rule.amount_paise / 12); break;
        default: monthlyAmount = rule.amount_paise;
      }
      contributions.push({
        monthlyAmount: Math.round(monthlyAmount * (gi.allocation_percent / 100)),
        startDate: rule.start_date,
        endDate: rule.end_date,
      });
    }
    const inv = investmentService.getInvestmentById(gi.investment_id);
    if (inv && inv.investment_type === 'rd' && inv.detail?.monthly_installment_paise) {
      contributions.push({
        monthlyAmount: Math.round(inv.detail.monthly_installment_paise * (gi.allocation_percent / 100)),
        startDate: inv.detail.start_date,
        endDate: inv.detail.maturity_date || null,
      });
    }
  }

  // Generate projection line (only if target is in the future)
  const projected: { month: string; value: number }[] = [];
  if (targetMonth > currentMonth) {
    let projValue = currentValue;
    const projStart = new Date(currentMonth + '-01');
    const projEnd = new Date(targetMonth + '-01');
    const d = new Date(projStart);
    while (d <= projEnd) {
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      projected.push({ month: m, value: Math.round(projValue) });
      let monthContribution = 0;
      for (const c of contributions) {
        const cStart = c.startDate.slice(0, 7);
        const cEnd = c.endDate ? c.endDate.slice(0, 7) : null;
        if (m >= cStart && (!cEnd || m <= cEnd)) {
          monthContribution += c.monthlyAmount;
        }
      }
      projValue = projValue * (1 + monthlyRate) + monthContribution;
      d.setMonth(d.getMonth() + 1);
    }
  }

  // Generate ideal path (compound growth curve from earliest to target)
  const ideal: { month: string; value: number }[] = [];
  const idealStart = new Date(earliestMonth + '-01');
  const idealEnd = new Date(targetMonth + '-01');
  const idealMonths = Math.max(1, (idealEnd.getFullYear() - idealStart.getFullYear()) * 12 + idealEnd.getMonth() - idealStart.getMonth());
  const startValue = actual.length > 0 ? actual[0].value : 0;

  // Calculate required monthly contribution: C = (target - startValue * (1+r)^n) / (((1+r)^n - 1) / r)
  const r = monthlyRate;
  const n = idealMonths;
  let requiredContribution = 0;
  if (r > 0 && n > 0) {
    const growthFactor = Math.pow(1 + r, n);
    const fvStart = startValue * growthFactor;
    const annuityFactor = (growthFactor - 1) / r;
    requiredContribution = Math.max(0, (target - fvStart) / annuityFactor);
  } else if (n > 0) {
    requiredContribution = Math.max(0, (target - startValue) / n);
  }

  const di = new Date(idealStart);
  let idealValue = startValue;
  let monthIdx = 0;
  while (di <= idealEnd) {
    const m = `${di.getFullYear()}-${String(di.getMonth() + 1).padStart(2, '0')}`;
    ideal.push({ month: m, value: Math.round(idealValue) });
    idealValue = idealValue * (1 + r) + requiredContribution;
    monthIdx++;
    di.setMonth(di.getMonth() + 1);
  }

  return { actual, projected, ideal, target };
}

function getTypeRates(): Record<string, number> {
  const db = getDb();
  const defaults: Record<string, number> = {
    rate_fd: 7, rate_rd: 7, rate_mf_equity: 12, rate_mf_hybrid: 10, rate_mf_debt: 7,
    rate_shares: 12, rate_gold: 8, rate_loan: 9, rate_fixed_asset: 6, rate_pension: 8, rate_savings_account: 4,
  };
  for (const key of Object.keys(defaults)) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) defaults[key] = parseFloat(row.value);
  }
  return defaults;
}

function getRateForType(type: string, rates: Record<string, number>): number {
  return rates[`rate_${type}`] || 8;
}

function projectInvestmentValue(inv: any, targetDate: string, rates: Record<string, number>): number {
  const detail = inv.detail || {};
  const enriched = valuationService.enrichInvestment(inv);
  const currentValue = enriched.current_value_paise || 0;
  const yearsToTarget = yearsBetween(today(), targetDate);

  switch (inv.investment_type) {
    case 'fd': {
      // Use maturity value if maturity_date <= target_date, otherwise project
      if (detail.maturity_date && detail.maturity_date <= targetDate) {
        return calc.calculateFDMaturityValue(detail.principal_paise, detail.interest_rate, detail.compounding, detail.start_date, detail.maturity_date);
      }
      return calc.calculateFDValue(detail.principal_paise, detail.interest_rate, detail.compounding, detail.start_date, targetDate);
    }
    case 'rd': {
      const effectiveDate = detail.maturity_date && detail.maturity_date <= targetDate ? detail.maturity_date : targetDate;
      return calc.calculateRDValue(detail.monthly_installment_paise, detail.interest_rate, detail.compounding, detail.start_date, effectiveDate);
    }
    case 'fixed_asset':
      return calc.calculateAssetValue(detail.purchase_price_paise || currentValue, detail.inflation_rate || getRateForType('fixed_asset', rates), detail.purchase_date, targetDate);
    case 'loan': {
      // Loan outstanding at target date (negative contribution)
      const outstanding = calc.calculateLoanOutstanding(detail.principal_paise, detail.interest_rate, detail.emi_paise, detail.start_date, targetDate);
      return -outstanding;
    }
    case 'pension':
      return calc.calculatePensionValue(currentValue, detail.interest_rate || getRateForType('pension', rates), detail.start_date || today(), targetDate);
    case 'savings_account':
      return currentValue; // No growth
    default: {
      // MF, Shares, Gold — compound at type rate
      const rate = getRateForType(inv.investment_type, rates);
      return Math.round(currentValue * Math.pow(1 + rate / 100, yearsToTarget));
    }
  }
}

// What-if simulation: project future value given monthly SIP amount and expected return
export function simulate(goalId: number, monthlySipPaise: number, expectedReturnPercent: number): {
  currentValue: number;
  projectedValue: number;
  targetAmount: number;
  shortfall: number;
  monthsToGoal: number;
  willMeetGoal: boolean;
} {
  const goal = getGoalById(goalId);
  if (!goal) throw new Error('Goal not found');

  const currentValue = goal.current_value_paise || 0;
  const yearsLeft = yearsBetween(today(), goal.target_date);
  const monthsLeft = Math.max(0, Math.round(yearsLeft * 12));
  const rates = getTypeRates();

  // Project each linked investment to target date
  let projectedInvestmentValue = 0;
  for (const gi of (goal.investments || [])) {
    const inv = investmentService.getInvestmentById(gi.investment_id);
    if (inv) {
      const projected = projectInvestmentValue(inv, goal.target_date, rates);
      projectedInvestmentValue += Math.round(projected * (gi.allocation_percent / 100));
    }
  }

  // Future value of additional SIP
  const monthlyReturn = expectedReturnPercent / 100 / 12;
  let fvSip = 0;
  if (monthlyReturn > 0) {
    fvSip = monthlySipPaise * ((Math.pow(1 + monthlyReturn, monthsLeft) - 1) / monthlyReturn);
  } else {
    fvSip = monthlySipPaise * monthsLeft;
  }

  const projectedValue = Math.round(projectedInvestmentValue + fvSip);
  const shortfall = Math.max(0, goal.target_amount_paise - projectedValue);

  return {
    currentValue,
    projectedValue,
    targetAmount: goal.target_amount_paise,
    shortfall,
    monthsToGoal: monthsLeft,
    willMeetGoal: projectedValue >= goal.target_amount_paise,
  };
}
