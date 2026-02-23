import { getDb } from '../db/connection.js';
import Papa from 'papaparse';
import type { ImportBatch } from 'shared';
import * as investmentService from './investmentService.js';
import * as transactionService from './transactionService.js';
import * as recurringService from './recurringService.js';
import { searchMFSchemes } from './marketDataService.js';
import { today, addMonths } from '../utils/date.js';

function isValidDateStr(val: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(new Date(val + 'T00:00:00').getTime());
}

export function parseCSV(csvContent: string): { headers: string[]; rows: string[][] } {
  const result = Papa.parse(csvContent, { skipEmptyLines: true });
  if (result.data.length === 0) return { headers: [], rows: [] };
  const headers = result.data[0] as string[];
  // Filter out template hint/example rows (first cell starts with '#')
  const rows = (result.data.slice(1) as string[][]).filter(row => !row[0]?.trim().startsWith('#'));
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
// Templates include a hints row and an example row (both start with '#' and are skipped by the importer)
export function getTemplate(investmentType: string): string {
  type ColDef = { header: string; required?: boolean; hint?: string; example?: string };

  function csvVal(val: string): string {
    return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
  }

  function buildTemplate(cols: ColDef[]): string {
    const headerRow = cols.map(c => c.header).join(',');
    const hintRow = cols.map((c, i) => {
      const parts: string[] = [];
      if (c.required) parts.push('REQUIRED');
      if (c.hint) parts.push(c.hint);
      const cell = parts.join('; ') || 'optional';
      return csvVal(i === 0 ? `# ${cell}` : cell);
    }).join(',');
    const exampleRow = cols.map((c, i) => {
      const cell = c.example ?? '';
      return csvVal(i === 0 ? `# ${cell}` : cell);
    }).join(',');
    return [headerRow, hintRow, exampleRow].join('\n') + '\n';
  }

  const mfCols = (nameEx: string, isinEx: string, amfiEx: string, schemeEx: string, amcEx: string, navEx: string): ColDef[] => [
    { header: 'name', required: true, hint: 'text', example: nameEx },
    { header: 'isin_code', required: true, hint: 'ISIN code (e.g. INF...)', example: isinEx },
    { header: 'amfi_code', hint: 'numeric code from mfapi.in (auto-resolved from ISIN if blank)', example: amfiEx },
    { header: 'scheme_name', hint: 'text', example: schemeEx },
    { header: 'amc', hint: 'text (fund house name)', example: amcEx },
    { header: 'folio_number', hint: 'text', example: '12345678' },
    { header: 'txn_type', hint: 'buy|sip|sell', example: 'sip' },
    { header: 'date', required: true, hint: 'YYYY-MM-DD', example: '2024-01-15' },
    { header: 'amount_rupees', required: true, hint: 'number in rupees', example: '10000' },
    { header: 'units', hint: 'number', example: '45.678' },
    { header: 'nav', hint: 'number in rupees', example: navEx },
  ];

  const templates: Record<string, ColDef[]> = {
    fd: [
      { header: 'name', required: true, hint: 'text', example: 'My HDFC FD' },
      { header: 'principal_rupees', required: true, hint: 'number in rupees', example: '100000' },
      { header: 'interest_rate', hint: '0-100', example: '7.5' },
      { header: 'compounding', hint: 'monthly|quarterly|half_yearly|yearly', example: 'quarterly' },
      { header: 'start_date', required: true, hint: 'YYYY-MM-DD', example: '2024-01-15' },
      { header: 'maturity_date', required: true, hint: 'YYYY-MM-DD', example: '2027-01-15' },
      { header: 'bank_name', hint: 'text', example: 'HDFC Bank' },
      { header: 'branch', hint: 'text', example: 'MG Road Branch' },
      { header: 'fd_number', hint: 'text', example: 'FD123456' },
    ],
    rd: [
      { header: 'name', required: true, hint: 'text', example: 'My RD' },
      { header: 'monthly_installment_rupees', required: true, hint: 'number in rupees', example: '5000' },
      { header: 'interest_rate', hint: '0-100', example: '6.5' },
      { header: 'compounding', hint: 'monthly|quarterly|half_yearly|yearly', example: 'quarterly' },
      { header: 'start_date', required: true, hint: 'YYYY-MM-DD (first EMI date)', example: '2024-01-01' },
      { header: 'maturity_date', required: true, hint: 'YYYY-MM-DD (one month after last EMI)', example: '2025-01-01' },
      { header: 'bank_name', hint: 'text', example: 'SBI' },
      { header: 'branch', hint: 'text', example: 'Anna Nagar Branch' },
    ],
    mf_equity: mfCols('Mirae Asset Large Cap', 'INF769K01010', '120503', 'Mirae Asset Large Cap Fund - Regular Plan', 'Mirae Asset', '218.95'),
    mf_hybrid: mfCols('HDFC Balanced Advantage', 'INF179K01VC6', '118989', 'HDFC Balanced Advantage Fund - Regular Plan', 'HDFC AMC', '83.05'),
    mf_debt: mfCols('ICICI Liquid Fund', 'INF109K01VQ1', '120505', 'ICICI Prudential Liquid Fund - Regular Plan', 'ICICI Prudential', '498.60'),
    shares: [
      { header: 'name', required: true, hint: 'text', example: 'Reliance Industries' },
      { header: 'ticker_symbol', required: true, hint: 'text', example: 'RELIANCE' },
      { header: 'exchange', hint: 'NSE|BSE', example: 'NSE' },
      { header: 'date', required: true, hint: 'YYYY-MM-DD', example: '2024-01-15' },
      { header: 'txn_type', hint: 'buy|sell', example: 'buy' },
      { header: 'quantity', required: true, hint: 'number > 0', example: '10' },
      { header: 'price_rupees', required: true, hint: 'number in rupees > 0', example: '2500.50' },
      { header: 'fees_rupees', hint: 'number in rupees', example: '20' },
      { header: 'demat_account', hint: 'text (used for first row of each ticker)', example: 'ZERODHA-12345678' },
    ],
    gold: [
      { header: 'name', required: true, hint: 'text', example: 'Gold Coin 10g' },
      { header: 'form', hint: 'physical|digital|sovereign_bond', example: 'physical' },
      { header: 'weight_grams', required: true, hint: 'number > 0', example: '10' },
      { header: 'purity', hint: '24K|22K|18K', example: '24K' },
      { header: 'purchase_date', hint: 'YYYY-MM-DD', example: '2023-11-05' },
      { header: 'purchase_price_per_gram_rupees', hint: 'number in rupees', example: '6500' },
    ],
    loan: [
      { header: 'name', required: true, hint: 'text', example: 'Home Loan - HDFC' },
      { header: 'principal_rupees', required: true, hint: 'number in rupees', example: '5000000' },
      { header: 'interest_rate', hint: '0-100', example: '8.5' },
      { header: 'emi_rupees', hint: 'number in rupees', example: '45000' },
      { header: 'start_date', required: true, hint: 'YYYY-MM-DD', example: '2024-01-01' },
      { header: 'end_date', hint: 'YYYY-MM-DD', example: '2044-01-01' },
      { header: 'loan_type', hint: 'home|car|personal|education|gold|other', example: 'home' },
      { header: 'lender', hint: 'text', example: 'HDFC Bank' },
    ],
    fixed_asset: [
      { header: 'name', required: true, hint: 'text', example: 'Honda City' },
      { header: 'category', hint: 'property|vehicle|jewelry|art|other', example: 'vehicle' },
      { header: 'purchase_date', required: true, hint: 'YYYY-MM-DD', example: '2022-06-15' },
      { header: 'purchase_price_rupees', required: true, hint: 'number in rupees', example: '1200000' },
      { header: 'inflation_rate', hint: '0-100', example: '6' },
      { header: 'description', hint: 'text', example: 'Honda City ZX 2022' },
    ],
    pension: [
      { header: 'name', required: true, hint: 'text', example: 'My EPF' },
      { header: 'pension_type', hint: 'nps|epf|ppf|gratuity|other', example: 'epf' },
      { header: 'interest_rate', hint: '0-100', example: '8.15' },
      { header: 'account_number', hint: 'text', example: 'MHBAN12345678' },
      { header: 'date', hint: 'YYYY-MM-DD (transaction date)', example: '2024-01-01' },
      { header: 'amount_rupees', hint: 'number in rupees (transaction amount)', example: '5000' },
    ],
    savings_account: [
      { header: 'name', required: true, hint: 'text', example: 'HDFC Savings' },
      { header: 'bank_name', hint: 'text', example: 'HDFC Bank' },
      { header: 'account_number', hint: 'text', example: '12345678901234' },
      { header: 'interest_rate', hint: '0-100', example: '3.5' },
      { header: 'ifsc', hint: 'text', example: 'HDFC0001234' },
      { header: 'date', hint: 'YYYY-MM-DD (transaction date)', example: '2024-01-01' },
      { header: 'amount_rupees', hint: 'number in rupees (transaction amount)', example: '50000' },
    ],
    transactions: [
      { header: 'investment_name', required: true, hint: 'must match existing investment name', example: 'My HDFC FD' },
      { header: 'txn_type', required: true, hint: 'buy|sell|deposit|withdrawal|dividend|interest|sip|emi|premium|bonus|split|maturity', example: 'deposit' },
      { header: 'date', required: true, hint: 'YYYY-MM-DD', example: '2024-01-15' },
      { header: 'amount_rupees', required: true, hint: 'number in rupees', example: '10000' },
      { header: 'units', hint: 'number', example: '45.678' },
      { header: 'price_per_unit_rupees', hint: 'number in rupees', example: '218.95' },
      { header: 'notes', hint: 'text', example: 'Monthly deposit' },
    ],
  };

  const cols = templates[investmentType] ?? [
    { header: 'name', required: true, hint: 'text', example: 'My Investment' },
    { header: 'date', required: true, hint: 'YYYY-MM-DD', example: '2024-01-15' },
    { header: 'amount_rupees', required: true, hint: 'number in rupees', example: '10000' },
  ];

  return buildTemplate(cols);
}

export async function processImport(
  userId: number,
  investmentType: string,
  csvContent: string,
  filename: string
): Promise<{ created: number; transactions: number; batchId: number; errors: string[] }> {
  const { headers, rows } = parseCSV(csvContent);
  if (rows.length === 0) return { created: 0, transactions: 0, batchId: 0, errors: ['No data rows found'] };

  const batch = createBatch(investmentType, filename, rows.length, {});
  const errors: string[] = [];
  let created = 0;
  let transactions = 0;

  const headerIdx = new Map<string, number>(headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const col = (row: string[], name: string): string => {
    const idx = headerIdx.get(name);
    return idx !== undefined ? (row[idx] ?? '').trim() : '';
  };
  const toPaise = (val: string): number => Math.round((parseFloat(val) || 0) * 100);

  // Cache of investment name/key → id created or found during this import
  const investmentCache = new Map<string, number>();

  if (investmentType === 'shares') {
    // Sort rows by date ascending so FIFO sell allocation works correctly
    const sorted = [...rows].sort((a, b) => col(a, 'date').localeCompare(col(b, 'date')));

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      try {
        const name = col(row, 'name');
        const ticker = col(row, 'ticker_symbol').toUpperCase();
        const exchange = (col(row, 'exchange') || 'NSE').toUpperCase();
        const date = col(row, 'date');
        const txnType = col(row, 'txn_type').toLowerCase() || 'buy';
        const quantity = parseFloat(col(row, 'quantity')) || 0;
        const priceRupees = parseFloat(col(row, 'price_rupees')) || 0;
        const feesRupees = parseFloat(col(row, 'fees_rupees')) || 0;

        if (!name || !ticker || !date || quantity <= 0 || priceRupees <= 0) {
          errors.push(`Row ${i + 2}: missing required fields (name, ticker_symbol, date, quantity, price_rupees)`);
          continue;
        }

        const key = `${ticker}|${exchange}`;
        let investmentId = investmentCache.get(key);
        if (!investmentId) {
          const existing = findShareByTicker(ticker, exchange, userId);
          if (existing) {
            investmentId = existing;
          } else {
            const inv = investmentService.createInvestment(userId, {
              investment_type: 'shares',
              name,
              is_active: true,
            }, {
              ticker_symbol: ticker,
              exchange,
              company_name: name,
              demat_account: col(row, 'demat_account') || null,
            });
            investmentId = inv.id;
            created++;
          }
          investmentCache.set(key, investmentId);
        }

        const pricePaise = Math.round(priceRupees * 100);
        const feesPaise = Math.round(feesRupees * 100);
        const amountPaise = Math.round(quantity * pricePaise);

        if (txnType === 'sell') {
          try {
            transactionService.executeSell(investmentId, userId, date, quantity, pricePaise, feesPaise);
          } catch {
            // Fall back to plain transaction if FIFO fails (e.g. lots not yet imported)
            transactionService.createTransaction(investmentId, userId, {
              txn_type: 'sell', date, amount_paise: amountPaise,
              units: quantity, price_per_unit_paise: pricePaise,
              fees_paise: feesPaise, import_batch_id: batch.id,
            });
          }
        } else {
          transactionService.createTransaction(investmentId, userId, {
            txn_type: txnType, date, amount_paise: amountPaise,
            units: quantity, price_per_unit_paise: pricePaise,
            fees_paise: feesPaise, import_batch_id: batch.id,
          });
        }
        transactions++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (['mf_equity', 'mf_hybrid', 'mf_debt'].includes(investmentType)) {
    // Sort by date ascending so FIFO sell allocation works correctly
    const sorted = [...rows].sort((a, b) => col(a, 'date').localeCompare(col(b, 'date')));
    // Cache isin_code → scheme_code resolutions to avoid duplicate searches
    const schemeCodeCache = new Map<string, string | null>();

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      try {
        const name = col(row, 'name');
        const isinCode = col(row, 'isin_code');
        const amfiCodeRaw = col(row, 'amfi_code').trim();
        const date = col(row, 'date');
        const txnType = col(row, 'txn_type').toLowerCase() || 'sip';
        const units = parseFloat(col(row, 'units')) || 0;
        const nav = parseFloat(col(row, 'nav')) || 0;
        const amountRupees = parseFloat(col(row, 'amount_rupees')) || 0;

        if (!name || !isinCode || !date) {
          errors.push(`Row ${i + 2}: missing required fields (name, isin_code, date)`);
          continue;
        }
        if (txnType !== 'sell' && amountRupees <= 0) {
          errors.push(`Row ${i + 2}: amount_rupees is required for ${txnType} transactions`);
          continue;
        }

        // Resolve scheme_code: use explicit amfi_code column first, then fall back to ISIN search
        let schemeCode: string | null;
        if (amfiCodeRaw) {
          schemeCode = amfiCodeRaw; // user-provided AMFI code — use directly
          schemeCodeCache.set(isinCode, schemeCode);
        } else if (schemeCodeCache.has(isinCode)) {
          schemeCode = schemeCodeCache.get(isinCode)!;
        } else {
          if (/^\d+$/.test(isinCode)) {
            schemeCode = isinCode; // legacy: numeric value in isin_code field is treated as AMFI code
          } else {
            try {
              const results = await searchMFSchemes(isinCode);
              schemeCode = results.length > 0 ? results[0].schemeCode : null;
            } catch { schemeCode = null; }
          }
          schemeCodeCache.set(isinCode, schemeCode);
        }

        let investmentId = investmentCache.get(isinCode);
        if (!investmentId) {
          const existing = findMFByIsinCode(isinCode, userId);
          if (existing) {
            investmentId = existing;
          } else {
            const inv = investmentService.createInvestment(userId, {
              investment_type: investmentType,
              name,
              is_active: true,
            }, {
              isin_code: isinCode,
              scheme_code: schemeCode || null,
              scheme_name: col(row, 'scheme_name') || null,
              folio_number: col(row, 'folio_number') || null,
              amc: col(row, 'amc') || null,
            });
            investmentId = inv.id;
            created++;
          }
          investmentCache.set(isinCode, investmentId);
        }

        const navPaise = nav ? Math.round(nav * 100) : null;
        const amountPaise = toPaise(col(row, 'amount_rupees'));

        if (txnType === 'sell') {
          const qty = units || (navPaise && amountPaise > 0 ? amountPaise / navPaise : 0);
          const price = navPaise || (qty > 0 && amountPaise > 0 ? Math.round(amountPaise / qty) : 0);
          if (qty <= 0 || price <= 0) {
            errors.push(`Row ${i + 2}: sell requires units + nav, or units + amount_rupees`);
            continue;
          }
          try {
            transactionService.executeSell(investmentId, userId, date, qty, price, 0);
          } catch {
            transactionService.createTransaction(investmentId, userId, {
              txn_type: 'sell', date,
              amount_paise: amountPaise || Math.round(qty * price),
              units: qty, price_per_unit_paise: price,
              fees_paise: 0, import_batch_id: batch.id,
            });
          }
        } else {
          transactionService.createTransaction(investmentId, userId, {
            txn_type: txnType,
            date,
            amount_paise: amountPaise,
            units: units || null,
            price_per_unit_paise: navPaise,
            fees_paise: 0,
            import_batch_id: batch.id,
          });
        }
        transactions++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'fd') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const principalRupees = parseFloat(col(row, 'principal_rupees')) || 0;
        const startDate = col(row, 'start_date');
        const maturityDate = col(row, 'maturity_date');

        if (!name || principalRupees <= 0 || !startDate || !maturityDate) {
          errors.push(`Row ${i + 2}: missing required fields (name, principal_rupees, start_date, maturity_date)`);
          continue;
        }
        if (!isValidDateStr(startDate)) {
          errors.push(`Row ${i + 2}: start_date "${startDate}" must be in YYYY-MM-DD format`);
          continue;
        }
        if (!isValidDateStr(maturityDate)) {
          errors.push(`Row ${i + 2}: maturity_date "${maturityDate}" must be in YYYY-MM-DD format`);
          continue;
        }

        investmentService.createInvestment(userId, {
          investment_type: 'fd',
          name,
          institution: col(row, 'bank_name') || null,
          is_active: true,
        }, {
          principal_paise: toPaise(col(row, 'principal_rupees')),
          interest_rate: parseFloat(col(row, 'interest_rate')) || 0,
          compounding: col(row, 'compounding') || 'quarterly',
          start_date: startDate,
          maturity_date: maturityDate,
          bank_name: col(row, 'bank_name') || null,
          branch: col(row, 'branch') || null,
          fd_number: col(row, 'fd_number') || null,
        });
        created++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'rd') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const installmentRupees = parseFloat(col(row, 'monthly_installment_rupees')) || 0;
        const startDate = col(row, 'start_date');
        const maturityDate = col(row, 'maturity_date');

        if (!name || installmentRupees <= 0 || !startDate || !maturityDate) {
          errors.push(`Row ${i + 2}: missing required fields (name, monthly_installment_rupees, start_date, maturity_date)`);
          continue;
        }
        if (!isValidDateStr(startDate)) {
          errors.push(`Row ${i + 2}: start_date "${startDate}" must be in YYYY-MM-DD format`);
          continue;
        }
        if (!isValidDateStr(maturityDate)) {
          errors.push(`Row ${i + 2}: maturity_date "${maturityDate}" must be in YYYY-MM-DD format`);
          continue;
        }

        const inv = investmentService.createInvestment(userId, {
          investment_type: 'rd',
          name,
          institution: col(row, 'bank_name') || null,
          is_active: true,
        }, {
          monthly_installment_paise: toPaise(col(row, 'monthly_installment_rupees')),
          interest_rate: parseFloat(col(row, 'interest_rate')) || 0,
          compounding: col(row, 'compounding') || 'quarterly',
          start_date: startDate,
          maturity_date: maturityDate,
          bank_name: col(row, 'bank_name') || null,
          branch: col(row, 'branch') || null,
        });
        created++;

        // Generate historical monthly deposit transactions from start_date up to today
        // (or the last installment date = one month before maturityDate, whichever is earlier)
        const installmentPaise = toPaise(col(row, 'monthly_installment_rupees'));
        const lastInstallDate = addMonths(maturityDate, -1); // last EMI is 1 month before maturity
        const todayStr = today();
        const maxDate = lastInstallDate <= todayStr ? lastInstallDate : todayStr;
        let emiDate = startDate;
        let lastGeneratedDate = '';
        while (emiDate <= maxDate) {
          transactionService.createTransaction(inv.id, userId, {
            txn_type: 'deposit',
            date: emiDate,
            amount_paise: installmentPaise,
            import_batch_id: batch.id,
          });
          lastGeneratedDate = emiDate;
          transactions++;
          const d = new Date(emiDate);
          d.setMonth(d.getMonth() + 1);
          emiDate = d.toISOString().split('T')[0];
        }

        // Create recurring rule for future transactions (same as manual add)
        try {
          const dayOfMonth = new Date(startDate + 'T00:00:00').getDate();
          const rule = await recurringService.createRule(userId, {
            investment_id: inv.id,
            txn_type: 'deposit',
            amount_paise: installmentPaise,
            frequency: 'monthly',
            day_of_month: isNaN(dayOfMonth) ? null : dayOfMonth,
            start_date: startDate,
            end_date: maturityDate,
          });
          // Set last_generated to the last imported EMI date so generateRecurringTransactions
          // doesn't re-create already-imported transactions
          if (lastGeneratedDate) {
            getDb().prepare('UPDATE recurring_rules SET last_generated = ? WHERE id = ?')
              .run(lastGeneratedDate, rule.id);
          }
        } catch {
          // Non-critical: don't fail the import if rule creation fails
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'gold') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const weightGrams = parseFloat(col(row, 'weight_grams')) || 0;

        if (!name || weightGrams <= 0) {
          errors.push(`Row ${i + 2}: missing required fields (name, weight_grams)`);
          continue;
        }

        const ppgPaise = toPaise(col(row, 'purchase_price_per_gram_rupees'));
        const purchaseDate = col(row, 'purchase_date') || null;

        const inv = investmentService.createInvestment(userId, {
          investment_type: 'gold',
          name,
          is_active: true,
        }, {
          form: col(row, 'form') || 'physical',
          weight_grams: weightGrams,
          purity: col(row, 'purity') || '24K',
          purchase_date: purchaseDate,
          purchase_price_per_gram_paise: ppgPaise,
        });
        created++;

        // Create initial buy transaction (same as manual add)
        if (ppgPaise > 0) {
          const amountPaise = Math.round(weightGrams * ppgPaise);
          transactionService.createTransaction(inv.id, userId, {
            txn_type: 'buy',
            date: purchaseDate || today(),
            amount_paise: amountPaise,
            notes: `Initial purchase | weight:${weightGrams}|ppg:${ppgPaise}`,
            import_batch_id: batch.id,
          });
          transactions++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'loan') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const principalRupees = parseFloat(col(row, 'principal_rupees')) || 0;
        const startDate = col(row, 'start_date');

        if (!name || principalRupees <= 0 || !startDate) {
          errors.push(`Row ${i + 2}: missing required fields (name, principal_rupees, start_date)`);
          continue;
        }

        investmentService.createInvestment(userId, {
          investment_type: 'loan',
          name,
          institution: col(row, 'lender') || null,
          is_active: true,
        }, {
          principal_paise: toPaise(col(row, 'principal_rupees')),
          interest_rate: parseFloat(col(row, 'interest_rate')) || 0,
          emi_paise: toPaise(col(row, 'emi_rupees')),
          start_date: startDate,
          end_date: col(row, 'end_date') || null,
          loan_type: col(row, 'loan_type') || 'other',
          lender: col(row, 'lender') || null,
        });
        created++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'fixed_asset') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const purchaseDate = col(row, 'purchase_date');
        const purchasePriceRupees = parseFloat(col(row, 'purchase_price_rupees')) || 0;

        if (!name || !purchaseDate || purchasePriceRupees <= 0) {
          errors.push(`Row ${i + 2}: missing required fields (name, purchase_date, purchase_price_rupees)`);
          continue;
        }

        investmentService.createInvestment(userId, {
          investment_type: 'fixed_asset',
          name,
          is_active: true,
        }, {
          category: col(row, 'category') || 'other',
          purchase_date: purchaseDate,
          purchase_price_paise: toPaise(col(row, 'purchase_price_rupees')),
          inflation_rate: parseFloat(col(row, 'inflation_rate')) || 6.0,
          description: col(row, 'description') || null,
        });
        created++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'pension') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const pensionType = col(row, 'pension_type') || 'other';
        const date = col(row, 'date');
        const amountRupees = parseFloat(col(row, 'amount_rupees')) || 0;

        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }

        const key = `${name}|${pensionType}`;
        let investmentId = investmentCache.get(key);
        if (!investmentId) {
          const db = getDb();
          const existing = db.prepare(
            `SELECT i.id FROM investments i JOIN investment_pension p ON p.investment_id = i.id WHERE i.user_id = ? AND i.name = ? AND p.pension_type = ?`
          ).get(userId, name, pensionType) as { id: number } | undefined;
          if (existing) {
            investmentId = existing.id;
          } else {
            const inv = investmentService.createInvestment(userId, {
              investment_type: 'pension',
              name,
              is_active: true,
            }, {
              pension_type: pensionType,
              interest_rate: parseFloat(col(row, 'interest_rate')) || 0,
              account_number: col(row, 'account_number') || null,
            });
            investmentId = inv.id;
            created++;
          }
          investmentCache.set(key, investmentId);
        }

        if (date && amountRupees > 0) {
          transactionService.createTransaction(investmentId, userId, {
            txn_type: 'deposit', date,
            amount_paise: toPaise(col(row, 'amount_rupees')),
            import_batch_id: batch.id,
          });
          transactions++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'savings_account') {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = col(row, 'name');
        const date = col(row, 'date');
        const amountRupees = parseFloat(col(row, 'amount_rupees')) || 0;

        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }

        let investmentId = investmentCache.get(name);
        if (!investmentId) {
          const db = getDb();
          const existing = db.prepare(
            `SELECT id FROM investments WHERE user_id = ? AND name = ? AND investment_type = 'savings_account'`
          ).get(userId, name) as { id: number } | undefined;
          if (existing) {
            investmentId = existing.id;
          } else {
            const inv = investmentService.createInvestment(userId, {
              investment_type: 'savings_account',
              name,
              institution: col(row, 'bank_name') || null,
              is_active: true,
            }, {
              bank_name: col(row, 'bank_name') || null,
              account_number: col(row, 'account_number') || null,
              interest_rate: parseFloat(col(row, 'interest_rate')) || 0,
              ifsc: col(row, 'ifsc') || null,
            });
            investmentId = inv.id;
            created++;
          }
          investmentCache.set(name, investmentId);
        }

        if (date && amountRupees > 0) {
          transactionService.createTransaction(investmentId, userId, {
            txn_type: 'deposit', date,
            amount_paise: toPaise(col(row, 'amount_rupees')),
            import_batch_id: batch.id,
          });
          transactions++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else if (investmentType === 'transactions') {
    // Import transactions into existing investments by name
    const db = getDb();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const investmentName = col(row, 'investment_name');
        const txnType = col(row, 'txn_type');
        const date = col(row, 'date');
        const amountRupees = parseFloat(col(row, 'amount_rupees')) || 0;

        if (!investmentName || !txnType || !date || amountRupees <= 0) {
          errors.push(`Row ${i + 2}: missing required fields (investment_name, txn_type, date, amount_rupees)`);
          continue;
        }

        let investmentId = investmentCache.get(investmentName);
        if (!investmentId) {
          const inv = db.prepare(
            `SELECT id FROM investments WHERE user_id = ? AND name = ?`
          ).get(userId, investmentName) as { id: number } | undefined;
          if (!inv) {
            errors.push(`Row ${i + 2}: investment not found: "${investmentName}"`);
            continue;
          }
          investmentId = inv.id;
          investmentCache.set(investmentName, investmentId);
        }

        const units = parseFloat(col(row, 'units')) || undefined;
        const priceRupees = parseFloat(col(row, 'price_per_unit_rupees')) || undefined;

        transactionService.createTransaction(investmentId, userId, {
          txn_type: txnType, date,
          amount_paise: toPaise(col(row, 'amount_rupees')),
          units: units ?? null,
          price_per_unit_paise: priceRupees ? Math.round(priceRupees * 100) : null,
          fees_paise: 0,
          notes: col(row, 'notes') || null,
          import_batch_id: batch.id,
        });
        transactions++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

  } else {
    errors.push(`Unsupported investment type: ${investmentType}`);
  }

  return { created, transactions, batchId: batch.id, errors };
}

function findShareByTicker(ticker: string, exchange: string, userId: number): number | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT i.id FROM investments i JOIN investment_shares s ON s.investment_id = i.id
     WHERE i.user_id = ? AND s.ticker_symbol = ? AND s.exchange = ? AND i.investment_type = 'shares'`
  ).get(userId, ticker, exchange) as { id: number } | undefined;
  return row ? row.id : null;
}

function findMFByIsinCode(isinCode: string, userId: number): number | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT i.id FROM investments i JOIN investment_mf m ON m.investment_id = i.id
     WHERE i.user_id = ? AND m.isin_code = ?`
  ).get(userId, isinCode) as { id: number } | undefined;
  return row ? row.id : null;
}
