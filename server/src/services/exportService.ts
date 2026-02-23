import * as investmentService from './investmentService.js';
import * as transactionService from './transactionService.js';
import * as valuationService from './valuationService.js';
import { toRupees } from '../utils/inr.js';

export function exportInvestments(investmentType?: string, userId?: number): string {
  const investments = investmentType
    ? investmentService.getInvestmentsByType(investmentType, userId)
    : investmentService.getAllInvestments(userId);

  const rows: string[][] = [];
  rows.push(['ID', 'Type', 'Name', 'Institution', 'ISIN Code', 'AMFI Code', 'Invested (INR)', 'Current Value (INR)', 'Gain (INR)', 'Gain %', 'Active']);

  for (const inv of investments) {
    const enriched = valuationService.enrichInvestment(inv);
    rows.push([
      String(inv.id),
      inv.investment_type,
      inv.name,
      inv.institution || '',
      (inv.detail as any)?.isin_code || '',
      (inv.detail as any)?.scheme_code || '',
      toRupees(enriched.invested_amount_paise || 0).toFixed(2),
      toRupees(enriched.current_value_paise || 0).toFixed(2),
      toRupees(enriched.gain_paise || 0).toFixed(2),
      (enriched.gain_percent || 0).toFixed(2),
      inv.is_active ? 'Yes' : 'No',
    ]);
  }

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

export function exportTransactions(investmentId?: number, userId?: number): string {
  const txns = investmentId
    ? transactionService.getTransactions(investmentId)
    : transactionService.getAllTransactions(userId);

  const rows: string[][] = [];
  rows.push(['ID', 'Investment', 'Type', 'Date', 'Amount (INR)', 'Units', 'Price/Unit (INR)', 'Fees (INR)', 'Notes']);

  for (const txn of txns) {
    rows.push([
      String(txn.id),
      txn.investment_name || '',
      txn.txn_type,
      txn.date,
      toRupees(txn.amount_paise).toFixed(2),
      txn.units?.toString() || '',
      txn.price_per_unit_paise ? toRupees(txn.price_per_unit_paise).toFixed(2) : '',
      toRupees(txn.fees_paise).toFixed(2),
      txn.notes || '',
    ]);
  }

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}
