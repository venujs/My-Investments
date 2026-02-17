import { getDb } from '../db/connection.js';
import Papa from 'papaparse';
import type { ImportBatch } from 'shared';

export function parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
  const result = Papa.parse(csvContent, { skipEmptyLines: true });
  if (result.data.length === 0) return { headers: [], rows: [] };
  const headers = result.data[0] as string[];
  const rows = result.data.slice(1) as string[][];
  return { headers, rows };
}

export function createBatch(investmentType: string, filename: string, rowCount: number, columnMapping: Record<string, string>): ImportBatch {
  const db = getDb();
  const result = db.prepare(
    `INSERT INTO import_batches (investment_type, filename, row_count, column_mapping) VALUES (?, ?, ?, ?)`
  ).run(investmentType, filename, rowCount, JSON.stringify(columnMapping));
  return db.prepare('SELECT * FROM import_batches WHERE id = ?').get(Number(result.lastInsertRowid)) as ImportBatch;
}

export function getBatch(id: number): ImportBatch | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM import_batches WHERE id = ?').get(id) as ImportBatch | undefined;
}

// Generate CSV template for a given investment type
export function getTemplate(investmentType: string): string {
  const templates: Record<string, string[]> = {
    fd: ['name', 'principal_rupees', 'interest_rate', 'compounding', 'start_date', 'maturity_date', 'bank_name', 'fd_number'],
    rd: ['name', 'monthly_installment_rupees', 'interest_rate', 'compounding', 'start_date', 'maturity_date', 'bank_name'],
    mf_equity: ['name', 'amfi_code', 'scheme_name', 'folio_number', 'date', 'amount_rupees', 'units', 'nav'],
    mf_hybrid: ['name', 'amfi_code', 'scheme_name', 'folio_number', 'date', 'amount_rupees', 'units', 'nav'],
    mf_debt: ['name', 'amfi_code', 'scheme_name', 'folio_number', 'date', 'amount_rupees', 'units', 'nav'],
    shares: ['name', 'ticker_symbol', 'exchange', 'date', 'txn_type', 'quantity', 'price_rupees', 'fees_rupees'],
    gold: ['name', 'form', 'weight_grams', 'purity', 'purchase_price_per_gram_rupees'],
    loan: ['name', 'principal_rupees', 'interest_rate', 'emi_rupees', 'start_date', 'end_date', 'loan_type', 'lender'],
    fixed_asset: ['name', 'category', 'purchase_date', 'purchase_price_rupees', 'inflation_rate', 'description'],
    pension: ['name', 'pension_type', 'interest_rate', 'account_number', 'date', 'amount_rupees'],
    savings_account: ['name', 'bank_name', 'account_number', 'interest_rate', 'ifsc', 'date', 'amount_rupees'],
    transactions: ['investment_name', 'txn_type', 'date', 'amount_rupees', 'units', 'price_per_unit_rupees', 'notes'],
  };

  const headers = templates[investmentType] || ['name', 'date', 'amount_rupees'];
  return headers.join(',') + '\n';
}
