export const InvestmentType = {
  FD: 'fd',
  RD: 'rd',
  MF_EQUITY: 'mf_equity',
  MF_HYBRID: 'mf_hybrid',
  MF_DEBT: 'mf_debt',
  SHARES: 'shares',
  GOLD: 'gold',
  LOAN: 'loan',
  FIXED_ASSET: 'fixed_asset',
  PENSION: 'pension',
  SAVINGS_ACCOUNT: 'savings_account',
} as const;
export type InvestmentType = (typeof InvestmentType)[keyof typeof InvestmentType];

export const InvestmentTypeLabels: Record<InvestmentType, string> = {
  fd: 'Fixed Deposit',
  rd: 'Recurring Deposit',
  mf_equity: 'Mutual Fund - Equity',
  mf_hybrid: 'Mutual Fund - Hybrid',
  mf_debt: 'Mutual Fund - Debt',
  shares: 'Shares',
  gold: 'Gold',
  loan: 'Loan',
  fixed_asset: 'Fixed Asset',
  pension: 'Pension',
  savings_account: 'Savings Account',
};

export const InvestmentTxnType = {
  BUY: 'buy',
  SELL: 'sell',
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  DIVIDEND: 'dividend',
  INTEREST: 'interest',
  SIP: 'sip',
  EMI: 'emi',
  PREMIUM: 'premium',
  BONUS: 'bonus',
  SPLIT: 'split',
  MATURITY: 'maturity',
} as const;
export type InvestmentTxnType = (typeof InvestmentTxnType)[keyof typeof InvestmentTxnType];

export const CompoundingFrequency = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  HALF_YEARLY: 'half_yearly',
  YEARLY: 'yearly',
} as const;
export type CompoundingFrequency = (typeof CompoundingFrequency)[keyof typeof CompoundingFrequency];

export const GoldForm = {
  PHYSICAL: 'physical',
  DIGITAL: 'digital',
  SOVEREIGN_BOND: 'sovereign_bond',
} as const;
export type GoldForm = (typeof GoldForm)[keyof typeof GoldForm];

export const GoldPurity = {
  K24: '24K',
  K22: '22K',
  K18: '18K',
} as const;
export type GoldPurity = (typeof GoldPurity)[keyof typeof GoldPurity];

export const Exchange = {
  NSE: 'NSE',
  BSE: 'BSE',
} as const;
export type Exchange = (typeof Exchange)[keyof typeof Exchange];

export const PensionType = {
  NPS: 'nps',
  EPF: 'epf',
  PPF: 'ppf',
  GRATUITY: 'gratuity',
  OTHER: 'other',
} as const;
export type PensionType = (typeof PensionType)[keyof typeof PensionType];

export const LoanType = {
  HOME: 'home',
  CAR: 'car',
  PERSONAL: 'personal',
  EDUCATION: 'education',
  GOLD: 'gold',
  OTHER: 'other',
} as const;
export type LoanType = (typeof LoanType)[keyof typeof LoanType];

export const FixedAssetCategory = {
  PROPERTY: 'property',
  VEHICLE: 'vehicle',
  JEWELRY: 'jewelry',
  ART: 'art',
  OTHER: 'other',
} as const;
export type FixedAssetCategory = (typeof FixedAssetCategory)[keyof typeof FixedAssetCategory];

export const RecurrenceFrequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;
export type RecurrenceFrequency = (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

export const MarketDataSource = {
  MFAPI: 'mfapi',
  YAHOO: 'yahoo',
} as const;
export type MarketDataSource = (typeof MarketDataSource)[keyof typeof MarketDataSource];
