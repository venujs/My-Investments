import { getDb } from '../db/connection.js';
import type { Investment } from 'shared';
import * as investmentService from './investmentService.js';
import * as transactionService from './transactionService.js';
import * as calc from './calculationService.js';
import { today } from '../utils/date.js';

export function getCurrentValue(investment: Investment): number {
  // Check for manual override first
  const override = investmentService.getLatestOverride(investment.id);
  if (override) return override.value_paise;

  const detail = investment.detail;
  if (!detail) return 0;

  switch (investment.investment_type) {
    case 'fd': {
      const todayStr = today();
      const effectiveDate = detail.maturity_date && detail.maturity_date < todayStr
        ? detail.maturity_date : todayStr;
      const fdValue = calc.calculateFDValue(detail.principal_paise, detail.interest_rate, detail.compounding, detail.start_date, effectiveDate);
      // Attach maturity value to detail for display
      detail.maturity_value_paise = calc.calculateFDMaturityValue(detail.principal_paise, detail.interest_rate, detail.compounding, detail.start_date, detail.maturity_date);
      return fdValue;
    }

    case 'rd': {
      const todayStr = today();
      const effectiveDate = detail.maturity_date && detail.maturity_date < todayStr
        ? detail.maturity_date : todayStr;
      const rdValue = calc.calculateRDValue(detail.monthly_installment_paise, detail.interest_rate, detail.compounding, detail.start_date, effectiveDate);
      // Attach maturity value to detail for display
      detail.maturity_value_paise = calc.calculateRDValue(detail.monthly_installment_paise, detail.interest_rate, detail.compounding, detail.start_date, detail.maturity_date);
      return rdValue;
    }

    case 'mf_equity':
    case 'mf_hybrid':
    case 'mf_debt': {
      const units = transactionService.getTotalUnits(investment.id);
      const navIdentifier = detail.scheme_code || detail.isin_code;
      const latestNav = getLatestMarketPrice(navIdentifier, 'mfapi');
      return latestNav ? Math.round(units * latestNav) : 0;
    }

    case 'shares': {
      const units = transactionService.getTotalUnits(investment.id);
      const latestPrice = getLatestMarketPrice(detail.ticker_symbol, ['yahoo', 'manual']);
      return latestPrice ? Math.round(units * latestPrice) : 0;
    }

    case 'gold': {
      const goldPrice = getLatestGoldPrice();
      if (!goldPrice) return 0;
      return calc.calculateGoldValue(detail.weight_grams, detail.purity, goldPrice);
    }

    case 'loan':
      return calc.calculateLoanOutstanding(detail.principal_paise, detail.interest_rate, detail.emi_paise, detail.start_date);

    case 'fixed_asset':
      return calc.calculateAssetValue(detail.purchase_price_paise, detail.inflation_rate, detail.purchase_date);

    case 'pension': {
      const totalDeposits = transactionService.getTotalInvested(investment.id);
      if (totalDeposits <= 0) return 0;
      // Get first transaction date as start
      const txns = transactionService.getTransactions(investment.id);
      const firstDate = txns.length > 0 ? txns[txns.length - 1].date : today();
      return calc.calculatePensionValue(totalDeposits, detail.interest_rate, firstDate);
    }

    case 'savings_account':
      return transactionService.getTotalInvested(investment.id);

    case 'expense': {
      const todayStr = today();
      if (detail.start_date && detail.expense_date &&
          detail.start_date <= todayStr && todayStr <= detail.expense_date) {
        return detail.amount_paise || 0;
      }
      return 0;
    }

    default:
      return 0;
  }
}

export function enrichInvestment(investment: Investment): Investment {
  const currentValue = getCurrentValue(investment);
  let invested = transactionService.getTotalInvested(investment.id);
  const detail = investment.detail;

  // For FD/RD/Fixed Asset/Loan, use principal/purchase price as invested amount if no transactions exist
  if (invested === 0 && detail) {
    switch (investment.investment_type) {
      case 'fd':
        invested = detail.principal_paise || 0;
        break;
      case 'rd': {
        // Count installments by calendar months (same logic as calculateRDValue)
        // Cap at maturity_date if already matured/closed
        const rdStart = new Date(detail.start_date);
        const todayStr = today();
        const endStr = detail.maturity_date && detail.maturity_date < todayStr
          ? detail.maturity_date : todayStr;
        const rdNow = new Date(endStr);
        let monthsPaid = 0;
        const rdD = new Date(rdStart);
        while (rdD <= rdNow) { monthsPaid++; rdD.setMonth(rdD.getMonth() + 1); }
        invested = (detail.monthly_installment_paise || 0) * monthsPaid;
        break;
      }
      case 'fixed_asset':
        invested = detail.purchase_price_paise || 0;
        break;
      case 'loan':
        invested = detail.principal_paise || 0;
        break;
      case 'gold':
        invested = Math.round((detail.weight_grams || 0) * (detail.purchase_price_per_gram_paise || 0));
        break;
      case 'expense':
        invested = detail.amount_paise || 0;
        break;
    }
  }

  investment.current_value_paise = currentValue;
  investment.invested_amount_paise = invested;

  // Attach latest market price and total units for shares
  if (investment.investment_type === 'shares' && investment.detail?.ticker_symbol) {
    const latestPrice = getLatestMarketPrice(investment.detail.ticker_symbol, ['yahoo', 'manual']);
    if (latestPrice) investment.detail.latest_price_paise = latestPrice;
    investment.detail.total_units = transactionService.getTotalUnits(investment.id);
  }

  // Attach latest NAV and total units for mutual funds
  if (['mf_equity', 'mf_hybrid', 'mf_debt'].includes(investment.investment_type) && investment.detail?.isin_code) {
    const navIdentifier = investment.detail.scheme_code || investment.detail.isin_code;
    const latestNav = getLatestMarketPrice(navIdentifier, 'mfapi');
    if (latestNav) investment.detail.latest_nav_paise = latestNav;
    investment.detail.total_units = transactionService.getTotalUnits(investment.id);
  }

  if (investment.investment_type === 'loan' || investment.investment_type === 'expense') {
    investment.gain_paise = 0;
    investment.gain_percent = 0;
  } else {
    investment.gain_paise = currentValue - invested;
    investment.gain_percent = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;
  }

  // Calculate XIRR
  if (currentValue > 0 && investment.investment_type !== 'loan' && investment.investment_type !== 'expense') {
    const txns = transactionService.getTransactions(investment.id);
    let cashflows: { date: string; amount: number }[];

    if (txns.length > 0) {
      cashflows = txns.map(t => ({
        date: t.date,
        amount: ['buy', 'sip', 'deposit', 'premium'].includes(t.txn_type) ? -t.amount_paise : t.amount_paise,
      }));
    } else {
      // Generate synthetic cashflows from detail data
      cashflows = buildSyntheticCashflows(investment);
    }

    if (cashflows.length > 0) {
      cashflows.sort((a, b) => a.date.localeCompare(b.date));
      cashflows.push({ date: today(), amount: currentValue });
      investment.xirr = calc.calculateXIRR(cashflows) ?? undefined;
      if (investment.xirr !== undefined) {
        investment.xirr = Math.round(investment.xirr * 10000) / 100; // as percentage
      }
    }
  }

  return investment;
}

export function calculateTypeXIRR(investmentType: string, userId?: number): number | null {
  const todayStr = today();
  let investments = investmentService.getInvestmentsByType(investmentType, userId);

  // For FD/RD, exclude matured and closed-early investments from the aggregate XIRR
  if (investmentType === 'fd' || investmentType === 'rd') {
    investments = investments.filter(inv => {
      const d = inv.detail;
      if (!d) return true;
      if (d.is_closed_early) return false;
      if (d.maturity_date && d.maturity_date <= todayStr) return false;
      return true;
    });
  }

  const allCashflows: { date: string; amount: number }[] = [];

  for (const inv of investments) {
    const enriched = enrichInvestment(inv);
    const txns = transactionService.getTransactions(inv.id);

    if (txns.length > 0) {
      for (const t of txns) {
        allCashflows.push({
          date: t.date,
          amount: ['buy', 'sip', 'deposit', 'premium'].includes(t.txn_type) ? -t.amount_paise : t.amount_paise,
        });
      }
    } else {
      // Generate synthetic cashflows from detail data
      const synthetic = buildSyntheticCashflows(inv);
      allCashflows.push(...synthetic);
    }

    const currentValue = enriched.current_value_paise || 0;
    if (currentValue > 0 && inv.investment_type !== 'loan') {
      allCashflows.push({ date: today(), amount: currentValue });
    }
  }

  if (allCashflows.length < 2) return null;
  allCashflows.sort((a, b) => a.date.localeCompare(b.date));
  const xirr = calc.calculateXIRR(allCashflows);
  if (xirr === null) return null;
  return Math.round(xirr * 10000) / 100;
}

function buildSyntheticCashflows(investment: Investment): { date: string; amount: number }[] {
  const detail = investment.detail;
  if (!detail) return [];
  const cashflows: { date: string; amount: number }[] = [];

  switch (investment.investment_type) {
    case 'fd':
      if (detail.principal_paise && detail.start_date) {
        cashflows.push({ date: detail.start_date, amount: -detail.principal_paise });
      }
      break;
    case 'rd':
      if (detail.monthly_installment_paise && detail.start_date) {
        const start = new Date(detail.start_date);
        const todayStr = today();
        const endStr = detail.maturity_date && detail.maturity_date < todayStr
          ? detail.maturity_date : todayStr;
        const now = new Date(endStr);
        const d = new Date(start);
        while (d <= now) {
          cashflows.push({ date: d.toISOString().split('T')[0], amount: -detail.monthly_installment_paise });
          d.setMonth(d.getMonth() + 1);
        }
      }
      break;
    case 'fixed_asset':
      if (detail.purchase_price_paise && detail.purchase_date) {
        cashflows.push({ date: detail.purchase_date, amount: -detail.purchase_price_paise });
      }
      break;
    case 'gold':
      if (detail.weight_grams && detail.purchase_price_per_gram_paise) {
        const invested = Math.round(detail.weight_grams * detail.purchase_price_per_gram_paise);
        const purchaseDate = detail.purchase_date || (investment.created_at ? investment.created_at.split('T')[0].split(' ')[0] : today());
        cashflows.push({ date: purchaseDate, amount: -invested });
      }
      break;
  }

  return cashflows;
}

function getLatestMarketPrice(symbol: string, source: string | string[]): number | null {
  const db = getDb();
  const sources = Array.isArray(source) ? source : [source];
  const placeholders = sources.map(() => '?').join(',');
  const row = db.prepare(
    `SELECT price_paise FROM market_prices WHERE symbol = ? AND source IN (${placeholders}) ORDER BY date DESC LIMIT 1`
  ).get(symbol, ...sources) as { price_paise: number } | undefined;
  return row ? row.price_paise : null;
}

function getLatestGoldPrice(): number | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT price_per_gram_paise FROM gold_prices ORDER BY date DESC LIMIT 1`
  ).get() as { price_per_gram_paise: number } | undefined;
  return row ? row.price_per_gram_paise : null;
}
