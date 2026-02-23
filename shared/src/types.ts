import type {
  InvestmentType, InvestmentTxnType, CompoundingFrequency,
  GoldForm, GoldPurity, Exchange, PensionType, LoanType,
  FixedAssetCategory, RecurrenceFrequency, MarketDataSource,
} from './enums.js';

export interface User {
  id: number;
  name: string;
  avatar: string | null;
  is_admin: boolean;
  created_at: string;
}

// Base investment (polymorphic)
export interface Investment {
  id: number;
  user_id: number;
  investment_type: InvestmentType;
  name: string;
  institution: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // computed
  current_value_paise?: number;
  invested_amount_paise?: number;
  gain_paise?: number;
  gain_percent?: number;
  xirr?: number;
  // joined detail (any of the detail types)
  detail?: Record<string, any>;
  user_name?: string;
}

// Type-specific detail interfaces
export interface FDDetail {
  investment_id: number;
  principal_paise: number;
  interest_rate: number;
  compounding: CompoundingFrequency;
  start_date: string;
  maturity_date: string;
  bank_name: string | null;
  branch: string | null;
  fd_number: string | null;
}

export interface RDDetail {
  investment_id: number;
  monthly_installment_paise: number;
  interest_rate: number;
  compounding: CompoundingFrequency;
  start_date: string;
  maturity_date: string;
  bank_name: string | null;
  branch: string | null;
}

export interface MFDetail {
  investment_id: number;
  isin_code: string;
  scheme_code: string | null;
  scheme_name: string | null;
  folio_number: string | null;
  amc: string | null;
}

export interface SharesDetail {
  investment_id: number;
  ticker_symbol: string;
  exchange: Exchange;
  company_name: string | null;
  demat_account: string | null;
}

export interface GoldDetail {
  investment_id: number;
  form: GoldForm;
  weight_grams: number;
  purity: GoldPurity;
  purchase_price_per_gram_paise: number;
  purchase_date?: string;
}

export interface LoanDetail {
  investment_id: number;
  principal_paise: number;
  interest_rate: number;
  emi_paise: number;
  start_date: string;
  end_date: string | null;
  loan_type: LoanType;
  lender: string | null;
}

export interface FixedAssetDetail {
  investment_id: number;
  category: FixedAssetCategory;
  purchase_date: string;
  purchase_price_paise: number;
  inflation_rate: number;
  description: string | null;
}

export interface PensionDetail {
  investment_id: number;
  pension_type: PensionType;
  interest_rate: number;
  account_number: string | null;
}

export interface SavingsAccountDetail {
  investment_id: number;
  bank_name: string | null;
  account_number: string | null;
  interest_rate: number;
  ifsc: string | null;
}

// Investment Transaction
export interface InvestmentTransaction {
  id: number;
  investment_id: number;
  user_id: number;
  txn_type: InvestmentTxnType;
  date: string;
  amount_paise: number;
  units: number | null;
  price_per_unit_paise: number | null;
  fees_paise: number;
  notes: string | null;
  recurring_rule_id: number | null;
  import_batch_id: number | null;
  created_at: string;
  // joined
  investment_name?: string;
  investment_type?: InvestmentType;
  user_name?: string;
}

// FIFO Lot
export interface InvestmentLot {
  id: number;
  investment_id: number;
  buy_txn_id: number;
  buy_date: string;
  units_bought: number;
  units_remaining: number;
  cost_per_unit_paise: number;
}

export interface LotSellAllocation {
  id: number;
  sell_txn_id: number;
  lot_id: number;
  units_sold: number;
  cost_per_unit_paise: number;
}

// Market Data
export interface MarketPrice {
  id: number;
  symbol: string;
  source: MarketDataSource;
  date: string;
  price_paise: number;
}

export interface GoldPrice {
  id: number;
  date: string;
  price_per_gram_paise: number;
}

// Value Tracking
export interface InvestmentOverride {
  id: number;
  investment_id: number;
  override_date: string;
  value_paise: number;
  reason: string | null;
  user_id: number;
}

export interface MonthlySnapshot {
  id: number;
  investment_id: number;
  year_month: string;
  invested_paise: number;
  current_value_paise: number;
  gain_paise: number;
}

export interface NetWorthSnapshot {
  id: number;
  user_id: number;
  year_month: string;
  total_invested_paise: number;
  total_value_paise: number;
  total_debt_paise: number;
  net_worth_paise: number;
  breakdown_json: string;
}

// Goals
export interface Goal {
  id: number;
  user_id: number;
  name: string;
  target_amount_paise: number;
  target_date: string;
  priority: number;
  notes: string | null;
  is_active: boolean;
  // computed
  current_value_paise?: number;
  progress_percent?: number;
  investments?: GoalInvestment[];
}

export interface GoalInvestment {
  goal_id: number;
  investment_id: number;
  allocation_percent: number;
  // joined
  investment_name?: string;
  investment_type?: InvestmentType;
  current_value_paise?: number;
  // MF detail (joined when available)
  scheme_name?: string;
  folio_number?: string;
}

// Recurring
export interface InvestmentRecurringRule {
  id: number;
  investment_id: number;
  user_id: number;
  txn_type: InvestmentTxnType;
  amount_paise: number;
  frequency: RecurrenceFrequency;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  last_generated: string | null;
  is_active: boolean;
  created_at: string;
  // joined
  investment_name?: string;
  investment_type?: InvestmentType;
  folio_number?: string;
  scheme_name?: string;
}

// Import
export interface ImportBatch {
  id: number;
  investment_type: InvestmentType;
  filename: string;
  row_count: number;
  column_mapping: string;
  imported_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

// Analytics
export interface DashboardStats {
  total_invested_paise: number;
  total_current_value_paise: number;
  total_gain_paise: number;
  total_gain_percent: number;
  total_debt_paise: number;
  net_worth_paise: number;
  investment_count: number;
}

export interface InvestmentBreakdown {
  investment_type: InvestmentType;
  label: string;
  invested_paise: number;
  current_value_paise: number;
  count: number;
}

// Tax
export interface CapitalGain {
  investment_id: number;
  investment_name: string;
  investment_type: InvestmentType;
  sell_date: string;
  sell_amount_paise: number;
  cost_basis_paise: number;
  gain_paise: number;
  holding_period_days: number;
  is_ltcg: boolean;
  tax_rate: number;
  tax_paise: number;
}

export interface TaxSummary {
  fy: string;
  equity_stcg_paise: number;
  equity_ltcg_paise: number;
  equity_ltcg_exemption_paise: number;
  debt_stcg_paise: number;
  debt_ltcg_paise: number;
  total_tax_paise: number;
  gains: CapitalGain[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
