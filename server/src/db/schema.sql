-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  avatar TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Base investments (polymorphic)
CREATE TABLE IF NOT EXISTS investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  investment_type TEXT NOT NULL CHECK(investment_type IN ('fd', 'rd', 'mf_equity', 'mf_hybrid', 'mf_debt', 'shares', 'gold', 'loan', 'fixed_asset', 'pension', 'savings_account')),
  name TEXT NOT NULL,
  institution TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Type detail tables (1:1 via investment_id)
CREATE TABLE IF NOT EXISTS investment_fd (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  principal_paise INTEGER NOT NULL,
  interest_rate REAL NOT NULL,
  compounding TEXT NOT NULL DEFAULT 'quarterly' CHECK(compounding IN ('monthly', 'quarterly', 'half_yearly', 'yearly')),
  start_date TEXT NOT NULL,
  maturity_date TEXT NOT NULL,
  bank_name TEXT,
  branch TEXT,
  fd_number TEXT
);

CREATE TABLE IF NOT EXISTS investment_rd (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  monthly_installment_paise INTEGER NOT NULL,
  interest_rate REAL NOT NULL,
  compounding TEXT NOT NULL DEFAULT 'quarterly' CHECK(compounding IN ('monthly', 'quarterly', 'half_yearly', 'yearly')),
  start_date TEXT NOT NULL,
  maturity_date TEXT NOT NULL,
  bank_name TEXT,
  branch TEXT
);

CREATE TABLE IF NOT EXISTS investment_mf (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  isin_code TEXT NOT NULL,
  scheme_code TEXT,
  scheme_name TEXT,
  folio_number TEXT,
  amc TEXT
);

CREATE TABLE IF NOT EXISTS investment_shares (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  ticker_symbol TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NSE' CHECK(exchange IN ('NSE', 'BSE')),
  company_name TEXT,
  demat_account TEXT
);

CREATE TABLE IF NOT EXISTS investment_gold (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  form TEXT NOT NULL CHECK(form IN ('physical', 'digital', 'sovereign_bond')),
  weight_grams REAL NOT NULL,
  purity TEXT NOT NULL DEFAULT '24K' CHECK(purity IN ('24K', '22K', '18K')),
  purchase_price_per_gram_paise INTEGER NOT NULL,
  purchase_date TEXT
);

CREATE TABLE IF NOT EXISTS investment_loan (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  principal_paise INTEGER NOT NULL,
  interest_rate REAL NOT NULL,
  emi_paise INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  loan_type TEXT NOT NULL DEFAULT 'other' CHECK(loan_type IN ('home', 'car', 'personal', 'education', 'gold', 'other')),
  lender TEXT
);

CREATE TABLE IF NOT EXISTS investment_fixed_asset (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other' CHECK(category IN ('property', 'vehicle', 'jewelry', 'art', 'other')),
  purchase_date TEXT NOT NULL,
  purchase_price_paise INTEGER NOT NULL,
  inflation_rate REAL NOT NULL DEFAULT 6.0,
  description TEXT
);

CREATE TABLE IF NOT EXISTS investment_pension (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  pension_type TEXT NOT NULL DEFAULT 'other' CHECK(pension_type IN ('nps', 'epf', 'ppf', 'gratuity', 'other')),
  interest_rate REAL NOT NULL DEFAULT 0,
  account_number TEXT
);

CREATE TABLE IF NOT EXISTS investment_savings_account (
  investment_id INTEGER PRIMARY KEY REFERENCES investments(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_number TEXT,
  interest_rate REAL NOT NULL DEFAULT 0,
  ifsc TEXT
);

-- Investment transactions
CREATE TABLE IF NOT EXISTS investment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  txn_type TEXT NOT NULL CHECK(txn_type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'sip', 'emi', 'premium', 'bonus', 'split', 'maturity')),
  date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  units REAL,
  price_per_unit_paise INTEGER,
  fees_paise INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  recurring_rule_id INTEGER REFERENCES recurring_rules(id),
  import_batch_id INTEGER REFERENCES import_batches(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FIFO lot tracking
CREATE TABLE IF NOT EXISTS investment_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  buy_txn_id INTEGER NOT NULL REFERENCES investment_transactions(id) ON DELETE CASCADE,
  buy_date TEXT NOT NULL,
  units_bought REAL NOT NULL,
  units_remaining REAL NOT NULL,
  cost_per_unit_paise INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lot_sell_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sell_txn_id INTEGER NOT NULL REFERENCES investment_transactions(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL REFERENCES investment_lots(id) ON DELETE CASCADE,
  units_sold REAL NOT NULL,
  cost_per_unit_paise INTEGER NOT NULL
);

-- Value overrides
CREATE TABLE IF NOT EXISTS investment_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  override_date TEXT NOT NULL,
  value_paise INTEGER NOT NULL,
  reason TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id)
);

-- Monthly snapshots
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  invested_paise INTEGER NOT NULL DEFAULT 0,
  current_value_paise INTEGER NOT NULL DEFAULT 0,
  gain_paise INTEGER NOT NULL DEFAULT 0,
  UNIQUE(investment_id, year_month)
);

-- Net worth snapshots
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  year_month TEXT NOT NULL,
  total_invested_paise INTEGER NOT NULL DEFAULT 0,
  total_value_paise INTEGER NOT NULL DEFAULT 0,
  total_debt_paise INTEGER NOT NULL DEFAULT 0,
  net_worth_paise INTEGER NOT NULL DEFAULT 0,
  breakdown_json TEXT,
  UNIQUE(user_id, year_month)
);

-- Market data cache
CREATE TABLE IF NOT EXISTS market_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('mfapi', 'yahoo', 'manual')),
  date TEXT NOT NULL,
  price_paise INTEGER NOT NULL,
  UNIQUE(symbol, source, date)
);

CREATE TABLE IF NOT EXISTS gold_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  price_per_gram_paise INTEGER NOT NULL
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  target_amount_paise INTEGER NOT NULL,
  target_date TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 5,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goal_investments (
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  allocation_percent REAL NOT NULL DEFAULT 100,
  PRIMARY KEY (goal_id, investment_id)
);

-- Recurring rules
CREATE TABLE IF NOT EXISTS recurring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  txn_type TEXT NOT NULL CHECK(txn_type IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'sip', 'emi', 'premium', 'bonus', 'split', 'maturity')),
  amount_paise INTEGER NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_month INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  last_generated TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Import batches
CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  column_mapping TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(investment_type);
CREATE INDEX IF NOT EXISTS idx_investment_txns_investment ON investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS idx_investment_txns_date ON investment_transactions(date);
CREATE INDEX IF NOT EXISTS idx_investment_txns_user ON investment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_lots_investment ON investment_lots(investment_id);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_yearmonth ON monthly_snapshots(year_month);
CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user ON net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_symbol ON market_prices(symbol, date);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_investment ON recurring_rules(investment_id);
