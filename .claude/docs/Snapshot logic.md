# Snapshot Logic — Plain English Explanation

## What is a snapshot?

A snapshot is a record of the value of your investments at a specific point in time. There are two kinds:

- **Monthly snapshot** (`monthly_snapshots` table): stores the invested amount, current value, and gain for each individual investment for a given year-month.
- **Net worth snapshot** (`net_worth_snapshots` table): stores the aggregate total invested, total value, total debt, and net worth for a user for a given year-month. Also stores a `breakdown_json` with per-investment-type totals (invested, value, count, gain%, XIRR).

---

## Two ways snapshots are created

### 1. "Calculate Snapshots" button (current month only)

This is the quick button on the Dashboard. It takes a live reading of every investment right now and stores it as this month's snapshot. It uses exactly the same valuation logic that powers the live investment pages (live NAV for mutual funds, live stock price for shares, compounded interest for FDs/RDs, etc.). This is always fast and accurate for the current month.

### 2. "Generate Historical Snapshots" button (last 36 months + last 10 Januaries)

This runs in the background and fills in historical data. For each historical target month, it figures out what the value of each investment would have been on the 1st of that month. The logic is more complex because live market prices don't exist for the past, so each investment type has a different strategy.

---

## Historical snapshot: which investments are included?

For each historical target month (e.g., March 2023), only investments that actually existed on the 1st of that month are included. The system checks the investment's "financial start date":

| Investment type | Start date used |
|---|---|
| FD, RD, Loan | `start_date` from the detail record |
| Gold, Fixed Asset | `purchase_date` from the detail record |
| Mutual Fund, Shares, Pension, Savings | Date of the first recorded transaction; falls back to `created_at` if no transactions |

If the investment's start date is after the target date (e.g., you bought a share in 2025, snapshot is for 2022), that investment is excluded from that month's snapshot.

**FDs and RDs that have matured are still included** — their value is capped at the maturity date value (i.e., the value doesn't keep growing after the FD has matured). This is correct: the FD existed and had value, it just stopped earning interest after maturity.

---

## How value is calculated for each investment type (historical)

### Fixed Deposit (FD)

Formula: `P × (1 + r/n)^(n×t)`

- `P` = principal amount
- `r` = annual interest rate (e.g., 0.07 for 7%)
- `n` = compounding periods per year (4 for quarterly, 12 for monthly, etc.)
- `t` = years elapsed from `start_date` to the target date

If the FD has already matured by the target date (e.g., maturity was in 2022, snapshot is for 2023), the value is calculated up to the maturity date — it doesn't keep compounding past that point.

**Invested amount**: `principal_paise`. If the FD was added manually (no buy transaction), the principal from the detail record is used directly.

---

### Recurring Deposit (RD)

Each monthly installment is treated as a separate deposit that compounds from its payment date to the target date.

Formula: for each installment paid on day `d`, its value on the target date is `installment × (1 + r/n)^(n × years_since_d)`. The total RD value is the sum of all installment values.

Like FDs, if the RD has matured, its value is capped at the maturity date.

**Invested amount**: counted as `monthly_installment × number_of_months_paid_up_to_target_date`. If no transactions exist, the months are counted by calendar (same day-of-month as start_date, one per month until target date).

---

### Mutual Fund (MF: Equity, Hybrid, Debt)

The system looks up the historical NAV (net asset value) for the fund on or near the target date using the mfapi.in service.

Value = `total_units_held × historical_NAV`

Units are counted by summing all buy/SIP transactions up to the target date and subtracting all sell transactions up to that date.

If no historical NAV can be fetched (e.g., no internet, fund no longer listed), the value is 0 for that snapshot.

**Invested amount**: sum of all buy/SIP transaction amounts up to the target date, minus any sell amounts.

---

### Shares

Same approach as mutual funds, but uses Yahoo Finance to look up the historical stock price.

Value = `total_units_held × historical_price`

If no historical price can be fetched, value is 0.

**Invested amount**: sum of buy transactions minus sell transactions up to the target date.

---

### Gold

Gold requires special handling because live gold prices are fetched infrequently.

The system tries three approaches in order:

1. **Historical gold price from database**: if the `gold_prices` table has a recorded price for any date on or before the target date, use the most recent one. This is the most accurate.

2. **Back-extrapolate from the most recent price**: if the only gold price available is a more recent one (e.g., today's price, but the snapshot is for a past date), the system works backwards using the gold appreciation rate setting (default 8% per year). Formula: `current_price / (1 + rate)^years_back`.

3. **Appreciate from purchase price**: if there is no gold price in the database at all, but the investment has a purchase price per gram, the system appreciates that price forward to the target date at the gold appreciation rate. Formula: `purchase_price × (1 + rate)^years_since_purchase`.

If none of these options produce data (empty gold prices table AND no purchase price entered), value is 0 — the user must either click "Fetch Prices" or enter a purchase price per gram.

Value = `weight_grams × price_per_gram × purity_factor` (where 24K = 1.0, 22K = 22/24 ≈ 0.917, 18K = 18/24 = 0.75)

**Invested amount**: sum of buy transactions if any exist; otherwise `weight_grams × purchase_price_per_gram`.

---

### Loan

Loan value represents the **outstanding balance** — how much is still owed.

Formula: monthly amortisation. Starting from `principal`, each month the interest is added and the EMI is subtracted. The balance after `n` months is the outstanding loan value.

Loans contribute to **total debt**, not total value, so they reduce net worth rather than add to it.

**Invested amount**: the original principal (used as a reference; loans don't have an "invested" concept in the usual sense).

---

### Fixed Asset (Property, Vehicle, Jewellery, etc.)

Value = `purchase_price × (1 + inflation_rate)^years_since_purchase`

The inflation rate is set per investment (default 6%). This models appreciation of the asset over time.

**Invested amount**: `purchase_price`.

---

### Pension (NPS, EPF, PPF, etc.)

Value = total deposits made up to the target date, compounded at the pension's interest rate.

Formula: `total_deposits × (1 + rate)^years_since_first_deposit`

This is a simplified model — it treats all deposits as if they were made at the date of the first deposit, compounded to the target date.

**Invested amount**: sum of all deposit transactions up to the target date.

---

### Savings Account

Value = balance, which is the sum of all deposits minus withdrawals up to the target date. No interest compounding is applied in snapshots (the interest earned is expected to be recorded as deposit transactions manually or via recurring rules).

**Invested amount**: same as value (balance).

---

## How net worth is calculated

For each historical month:

```
Total Value   = sum of current_value for all non-loan investments
Total Debt    = sum of current_value for all loan investments
Total Invested = sum of invested_amount for all non-loan investments
Net Worth     = Total Value − Total Debt
```

These four numbers are stored as columns in `net_worth_snapshots`. The per-type breakdown (how much of the total comes from FDs, gold, MFs, etc.) is stored as a JSON object in `breakdown_json`.

---

## XIRR per investment type

After computing all investment values for a month, the system also calculates an XIRR (Extended Internal Rate of Return) for each investment type. XIRR is the annualised return rate that makes the net present value of all cashflows equal to zero.

For each type, the cashflows are:
- All inflows (buy, SIP, deposit, premium transactions) as **negative** amounts (money going out)
- All outflows (sell, withdrawal, maturity transactions) as **positive** amounts (money coming in)
- The investment's current value on the target date as a final **positive** amount (as if you sold everything)

For instruments with no transactions (manually added FDs, gold without buy transactions), synthetic cashflows are generated from the detail fields (e.g., principal deposit on start_date for FD, monthly installments for RD).

The XIRR is calculated using Newton-Raphson iteration. The result is stored as a percentage in `breakdown_json`.

---

## What can go wrong / known limitations

| Situation | Result |
|---|---|
| MF historical NAV not available (old fund, no internet) | Value = 0 for that month |
| Share historical price not available | Value = 0 for that month |
| Gold added without a purchase price AND no gold prices fetched | Value = 0; fix by clicking "Fetch Prices" or entering purchase price |
| FD/RD added without start_date (shouldn't happen; schema enforces NOT NULL) | Excluded from historical months |
| Any investment's calculation produces an unexpected error | That investment is skipped for that month (error logged to server console); other investments still calculated |
| Very old historical months (e.g., 10 years ago) with no transaction data | MF/shares = 0; FD/RD/gold can still be estimated |
