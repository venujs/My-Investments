import { z } from 'zod';

// Auth
export const loginSchema = z.object({
  userId: z.number().int().positive(),
  pin: z.string().min(4).max(8),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(50),
  pin: z.string().min(4).max(8),
  avatar: z.string().nullable().optional(),
  is_admin: z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  avatar: z.string().nullable().optional(),
  is_admin: z.boolean().optional(),
});

export const changePinSchema = z.object({
  currentPin: z.string().min(4).max(8),
  newPin: z.string().min(4).max(8),
});

// Investment types
const investmentTypes = ['fd', 'rd', 'mf_equity', 'mf_hybrid', 'mf_debt', 'shares', 'gold', 'loan', 'fixed_asset', 'pension', 'savings_account'] as const;
const txnTypes = ['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'sip', 'emi', 'premium', 'bonus', 'split', 'maturity'] as const;
const compoundingTypes = ['monthly', 'quarterly', 'half_yearly', 'yearly'] as const;
const goldForms = ['physical', 'digital', 'sovereign_bond'] as const;
const goldPurities = ['24K', '22K', '18K'] as const;
const exchanges = ['NSE', 'BSE'] as const;
const pensionTypes = ['nps', 'epf', 'ppf', 'gratuity', 'other'] as const;
const loanTypes = ['home', 'car', 'personal', 'education', 'gold', 'other'] as const;
const assetCategories = ['property', 'vehicle', 'jewelry', 'art', 'other'] as const;
const frequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Base investment schema
export const createInvestmentSchema = z.object({
  investment_type: z.enum(investmentTypes),
  name: z.string().min(1).max(200),
  institution: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateInvestmentSchema = createInvestmentSchema.partial().omit({ investment_type: true });

// Type-specific detail schemas
export const fdDetailSchema = z.object({
  principal_paise: z.number().int().positive(),
  interest_rate: z.number().positive().max(100),
  compounding: z.enum(compoundingTypes),
  start_date: z.string().regex(dateRegex),
  maturity_date: z.string().regex(dateRegex),
  bank_name: z.string().max(200).nullable().optional(),
  branch: z.string().max(200).nullable().optional(),
  fd_number: z.string().max(100).nullable().optional(),
});

export const rdDetailSchema = z.object({
  monthly_installment_paise: z.number().int().positive(),
  interest_rate: z.number().positive().max(100),
  compounding: z.enum(compoundingTypes),
  start_date: z.string().regex(dateRegex),
  maturity_date: z.string().regex(dateRegex),
  bank_name: z.string().max(200).nullable().optional(),
  branch: z.string().max(200).nullable().optional(),
});

export const mfDetailSchema = z.object({
  isin_code: z.string().min(1).max(20),
  scheme_code: z.string().max(20).nullable().optional(),
  scheme_name: z.string().max(300).nullable().optional(),
  folio_number: z.string().max(100).nullable().optional(),
  amc: z.string().max(200).nullable().optional(),
});

export const sharesDetailSchema = z.object({
  ticker_symbol: z.string().min(1).max(20),
  exchange: z.enum(exchanges),
  company_name: z.string().max(200).nullable().optional(),
  demat_account: z.string().max(100).nullable().optional(),
});

export const goldDetailSchema = z.object({
  form: z.enum(goldForms),
  weight_grams: z.number().positive(),
  purity: z.enum(goldPurities),
  purchase_price_per_gram_paise: z.number().int().min(0),
});

export const loanDetailSchema = z.object({
  principal_paise: z.number().int().positive(),
  interest_rate: z.number().positive().max(100),
  emi_paise: z.number().int().min(0),
  start_date: z.string().regex(dateRegex),
  end_date: z.string().regex(dateRegex).nullable().optional(),
  loan_type: z.enum(loanTypes),
  lender: z.string().max(200).nullable().optional(),
});

export const fixedAssetDetailSchema = z.object({
  category: z.enum(assetCategories),
  purchase_date: z.string().regex(dateRegex),
  purchase_price_paise: z.number().int().positive(),
  inflation_rate: z.number().min(0).max(100),
  description: z.string().max(500).nullable().optional(),
});

export const pensionDetailSchema = z.object({
  pension_type: z.enum(pensionTypes),
  interest_rate: z.number().min(0).max(100),
  account_number: z.string().max(100).nullable().optional(),
});

export const savingsAccountDetailSchema = z.object({
  bank_name: z.string().max(200).nullable().optional(),
  account_number: z.string().max(50).nullable().optional(),
  interest_rate: z.number().min(0).max(100),
  ifsc: z.string().max(20).nullable().optional(),
});

// Combined create schema (base + detail)
export const createInvestmentWithDetailSchema = z.object({
  investment: createInvestmentSchema,
  detail: z.record(z.any()),
});

// Transaction schemas
export const investmentTxnSchema = z.object({
  txn_type: z.enum(txnTypes),
  date: z.string().regex(dateRegex),
  amount_paise: z.number().int().positive(),
  units: z.number().positive().nullable().optional(),
  price_per_unit_paise: z.number().int().positive().nullable().optional(),
  fees_paise: z.number().int().min(0).optional().default(0),
  notes: z.string().max(500).nullable().optional(),
  weight_grams: z.number().positive().nullable().optional(),
  price_per_gram_paise: z.number().int().positive().nullable().optional(),
});

export const sellSchema = z.object({
  date: z.string().regex(dateRegex),
  units: z.number().positive(),
  price_per_unit_paise: z.number().int().positive(),
  fees_paise: z.number().int().min(0).optional().default(0),
  notes: z.string().max(500).nullable().optional(),
});

// Override
export const overrideSchema = z.object({
  override_date: z.string().regex(dateRegex),
  value_paise: z.number().int().min(0),
  reason: z.string().max(500).nullable().optional(),
});

// Recurring rule
export const recurringRuleSchema = z.object({
  investment_id: z.number().int().positive(),
  txn_type: z.enum(txnTypes),
  amount_paise: z.number().int().positive(),
  frequency: z.enum(frequencies),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  start_date: z.string().regex(dateRegex),
  end_date: z.string().regex(dateRegex).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

// Goal
export const goalSchema = z.object({
  name: z.string().min(1).max(200),
  target_amount_paise: z.number().int().positive(),
  target_date: z.string().regex(dateRegex),
  priority: z.number().int().min(1).max(10).optional().default(5),
  notes: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const goalInvestmentSchema = z.object({
  investment_id: z.number().int().positive(),
  allocation_percent: z.number().min(0).max(100),
});

// Tax
export const taxCalculateSchema = z.object({
  fy_start: z.string().regex(dateRegex),
  fy_end: z.string().regex(dateRegex),
});

// Import
export const importExecuteSchema = z.object({
  batchId: z.number().int().positive(),
  mapping: z.record(z.string()),
  investment_type: z.enum(investmentTypes),
});
