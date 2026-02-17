import { getDb } from '../db/connection.js';
import { daysBetween } from '../utils/date.js';
import * as transactionService from './transactionService.js';
import type { CapitalGain, TaxSummary } from 'shared';

// FY 2025-26 tax rules
const EQUITY_LTCG_THRESHOLD_DAYS = 365; // > 1 year
const DEBT_LTCG_THRESHOLD_DAYS = 365 * 3; // > 3 years (pre-2023 rules for reference)
const EQUITY_LTCG_RATE = 0.125; // 12.5%
const EQUITY_STCG_RATE = 0.20; // 20%
const EQUITY_LTCG_EXEMPTION_PAISE = 125000 * 100; // 1.25 lakh

function isEquityType(investmentType: string): boolean {
  return ['mf_equity', 'shares'].includes(investmentType);
}

export function calculateCapitalGains(fyStart: string, fyEnd: string, userId?: number): TaxSummary {
  const db = getDb();

  // Get all sell transactions in the FY
  let sql = `SELECT t.*, i.investment_type, i.name as investment_name
     FROM investment_transactions t
     JOIN investments i ON t.investment_id = i.id
     WHERE t.txn_type = 'sell' AND t.date >= ? AND t.date <= ?`;
  const params: any[] = [fyStart, fyEnd];
  if (userId) {
    sql += ' AND t.user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY t.date ASC';

  const sellTxns = db.prepare(sql).all(...params) as any[];
  const gains: CapitalGain[] = [];
  let equityStcg = 0;
  let equityLtcg = 0;
  let debtStcg = 0;
  let debtLtcg = 0;

  for (const sell of sellTxns) {
    const allocations = transactionService.getSellAllocations(sell.id);
    for (const alloc of allocations) {
      const holdingDays = daysBetween(alloc.buy_date, sell.date);
      const costBasis = Math.round(alloc.units_sold * alloc.cost_per_unit_paise);
      const sellAmount = Math.round(alloc.units_sold * sell.price_per_unit_paise);
      const gain = sellAmount - costBasis;

      const isEquity = isEquityType(sell.investment_type);
      const ltcgThreshold = isEquity ? EQUITY_LTCG_THRESHOLD_DAYS : DEBT_LTCG_THRESHOLD_DAYS;
      const isLtcg = holdingDays > ltcgThreshold;

      let taxRate: number;
      if (isEquity) {
        taxRate = isLtcg ? EQUITY_LTCG_RATE : EQUITY_STCG_RATE;
      } else {
        // Debt: taxed at slab rate (approximate with 30% for now)
        taxRate = isLtcg ? 0.20 : 0.30;
      }

      const taxableGain = Math.max(0, gain);
      const tax = Math.round(taxableGain * taxRate);

      gains.push({
        investment_id: sell.investment_id,
        investment_name: sell.investment_name,
        investment_type: sell.investment_type,
        sell_date: sell.date,
        sell_amount_paise: sellAmount,
        cost_basis_paise: costBasis,
        gain_paise: gain,
        holding_period_days: holdingDays,
        is_ltcg: isLtcg,
        tax_rate: taxRate * 100,
        tax_paise: tax,
      });

      if (isEquity) {
        if (isLtcg) equityLtcg += gain;
        else equityStcg += gain;
      } else {
        if (isLtcg) debtLtcg += gain;
        else debtStcg += gain;
      }
    }
  }

  // Apply LTCG exemption for equity
  const equityLtcgExemption = Math.min(Math.max(0, equityLtcg), EQUITY_LTCG_EXEMPTION_PAISE);
  const taxableEquityLtcg = Math.max(0, equityLtcg - equityLtcgExemption);

  const totalTax = Math.round(
    Math.max(0, equityStcg) * EQUITY_STCG_RATE +
    taxableEquityLtcg * EQUITY_LTCG_RATE +
    Math.max(0, debtStcg) * 0.30 +
    Math.max(0, debtLtcg) * 0.20
  );

  return {
    fy: `${fyStart.substring(0, 4)}-${fyEnd.substring(2, 4)}`,
    equity_stcg_paise: equityStcg,
    equity_ltcg_paise: equityLtcg,
    equity_ltcg_exemption_paise: equityLtcgExemption,
    debt_stcg_paise: debtStcg,
    debt_ltcg_paise: debtLtcg,
    total_tax_paise: totalTax,
    gains,
  };
}
