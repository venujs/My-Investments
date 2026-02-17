# Test Cases — My Investments

Total: 197 test cases across 16 sections.

---

## 1. First-Time Setup (5)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.1 | Setup page shown on first launch | Open app with no users in DB | Redirected to `/setup` page |
| 1.2 | Create admin user | Enter name, 4-digit PIN, confirm PIN → submit | User created, redirected to dashboard |
| 1.3 | PIN mismatch rejected | Enter name, PIN "1234", confirm "5678" → submit | Error: PINs do not match |
| 1.4 | PIN too short rejected | Enter name, PIN "12" → submit | Validation error: PIN must be 4-8 characters |
| 1.5 | Setup blocked after first user exists | Call `POST /api/auth/setup` when users already exist | 400 error: Setup already completed |

---

## 2. Authentication & Session (10)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2.1 | User selection displayed | Navigate to `/login` | All users shown with names and avatars |
| 2.2 | Successful login | Select user, enter correct PIN → submit | Session created, redirected to dashboard |
| 2.3 | Incorrect PIN rejected | Select user, enter wrong PIN → submit | Error: Invalid PIN |
| 2.4 | Protected routes redirect to login | Access `/goals` without session | Redirected to `/login` |
| 2.5 | Logout destroys session | Click logout | Session destroyed, redirected to `/login` |
| 2.6 | Session persists on refresh | Login, refresh browser | Still authenticated, dashboard shown |
| 2.7 | `/login` redirects if already authenticated | Login, then navigate to `/login` | Redirected to `/` |
| 2.8 | `GET /api/auth/me` returns current user | Call after login | Returns user object with id, name, is_admin |
| 2.9 | `GET /api/auth/me` returns 401 without session | Call without session | 401 Unauthorized |
| 2.10 | Session expires after 30 days | Set session cookie maxAge to past | Next request returns 401 |

---

## 3. User Management (8)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.1 | Admin creates new user | `POST /api/users` with name + PIN | User created with hashed PIN |
| 3.2 | Non-admin cannot create user | Non-admin calls `POST /api/users` | 403 Forbidden |
| 3.3 | Admin deletes user | `DELETE /api/users/:id` (not self) | User deleted |
| 3.4 | Admin cannot delete self | `DELETE /api/users/:id` (own id) | 400 error: Cannot delete yourself |
| 3.5 | Change own PIN with correct current PIN | `POST /api/users/:id/change-pin` with correct currentPin | PIN updated |
| 3.6 | Change own PIN with wrong current PIN | Provide incorrect currentPin | 400 error: Invalid current PIN |
| 3.7 | Admin changes another user's PIN | Admin calls change-pin for another user | PIN updated without requiring current PIN |
| 3.8 | Update user name | `PUT /api/users/:id` with new name | Name updated |

---

## 4. Fixed Deposits (12)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.1 | Create FD | Fill all fields (principal, rate, compounding, dates) → save | FD created with detail in `investment_fd` |
| 4.2 | FD current value calculation | Create FD with ₹1,00,000 at 7% quarterly, 1 year ago | Value = P×(1+r/n)^(nt), approximately ₹1,07,186 |
| 4.3 | FD maturity value shown | View FD card | Maturity value displayed separately from current value |
| 4.4 | Edit FD details | Change interest rate from 7% to 7.5% | Rate updated, value recalculated |
| 4.5 | FD compounding options | Create FDs with monthly/quarterly/half_yearly/yearly | Each uses correct compounding periods |
| 4.6 | FD invested amount without transactions | Create FD, no transactions added | Invested = principal_paise |
| 4.7 | Delete FD | Click delete, confirm | FD and detail removed |
| 4.8 | FD with manual override | Add override value ₹1,10,000 | Override shown as current value instead of calculated |
| 4.9 | FD XIRR calculation | Create FD with known values | XIRR computed via Newton-Raphson, matches expected rate |
| 4.10 | Invalid rate rejected | Enter interest_rate = 150 | Validation error: max 100% |
| 4.11 | Invalid dates rejected | Enter maturity_date before start_date | Server accepts (no cross-field validation) but displays correctly |
| 4.12 | FD bank details optional | Create FD without bank_name, branch, fd_number | Created successfully with null optional fields |

---

## 5. Recurring Deposits (8)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.1 | Create RD | Fill installment, rate, compounding, dates → save | RD created in `investment_rd` |
| 5.2 | RD auto-creates recurring rule | Create RD with start_date 15th | Recurring rule created: monthly, day_of_month=15, type=deposit |
| 5.3 | RD value calculation | ₹5,000/month at 7% quarterly, 12 months | Sum of installments compounded individually |
| 5.4 | RD invested without transactions | Create RD, no transactions | Invested = installment × months elapsed |
| 5.5 | RD maturity value displayed | View RD card | Shows projected maturity value |
| 5.6 | Edit RD installment | Change monthly installment amount | Updated, value recalculated |
| 5.7 | Delete RD | Delete RD investment | RD, detail, and associated recurring rule removed |
| 5.8 | RD compounding frequencies | Create RDs with each compounding type | Values differ based on compounding frequency |

---

## 6. Mutual Funds (16)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.1 | Search MF scheme | Type scheme name in search field | Autocomplete results from mfapi.in |
| 6.2 | Create MF investment | Select scheme, fill folio → save | Created with amfi_code, scheme_name in `investment_mf` |
| 6.3 | Buy transaction creates lot | Add buy: 100 units at ₹50 NAV | Transaction created + lot with units_remaining=100 |
| 6.4 | SIP transaction creates lot | Add SIP: ₹5000 at ₹50 NAV (100 units) | Transaction + lot created |
| 6.5 | MF value = units × NAV | Buy 100 units, NAV=₹55 | Current value = ₹5,500 |
| 6.6 | Fetch NAV updates price | Click "Fetch NAV" | Latest NAV fetched from mfapi.in, cached in market_prices |
| 6.7 | Edit folio number | Click edit on MF card, change folio → save | Folio updated in investment_mf |
| 6.8 | Edit MF name | Click edit, change name → save | Name updated in investments table |
| 6.9 | MF FIFO sell — single lot | Buy 100 units, sell 30 units | Lot units_remaining = 70, allocation record created |
| 6.10 | MF FIFO sell — multiple lots | Buy 50 then 50, sell 70 | First lot fully consumed (0), second lot = 30 remaining |
| 6.11 | Sell more units than available | Try to sell 200 when only 100 owned | Warning issued, partial allocation |
| 6.12 | View lots | Click lots section on MF card | Shows all lots with buy date, units bought, units remaining, cost |
| 6.13 | MF types grouped correctly | Create mf_equity, mf_hybrid, mf_debt | All share `investment_mf` detail table, filtered correctly on page |
| 6.14 | Dividend transaction | Add dividend transaction ₹500 | Transaction recorded, no lot created |
| 6.15 | Delete buy transaction | Delete a buy that created a lot | Lot removed |
| 6.16 | MF with no NAV available | Create MF, don't fetch NAV | Current value = ₹0 |

---

## 7. Shares (10)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.1 | Create share investment | Enter ticker (RELIANCE), exchange (NSE) → save | Created with `investment_shares` detail |
| 7.2 | Buy creates FIFO lot | Buy 50 shares at ₹2500 | Lot created, units_remaining=50 |
| 7.3 | Share value = units × price | 50 shares, CMP ₹2600 | Value = ₹1,30,000 |
| 7.4 | FIFO sell across lots | Buy 30 at ₹2400, buy 30 at ₹2600, sell 40 | First lot consumed (0), second lot = 20 remaining |
| 7.5 | Fetch stock price | Click fetch prices | Yahoo Finance price cached (source='yahoo') |
| 7.6 | Manual price entry | Set manual price ₹2700 for ticker | Stored with source='manual', takes precedence |
| 7.7 | Price history chart | View shares card with history | Line chart showing 1-year price history |
| 7.8 | NSE ticker mapping | Create share with exchange=NSE | Yahoo API called with .NS suffix |
| 7.9 | BSE ticker mapping | Create share with exchange=BSE | Yahoo API called with .BO suffix |
| 7.10 | Delete share investment | Delete share | Investment, detail, lots, transactions all removed |

---

## 8. Gold (10)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.1 | Create gold investment | Select form=physical, 10g, 24K → save | Gold detail created, initial buy transaction auto-created |
| 8.2 | Gold value = weight × price × purity | 10g, 24K, gold price ₹7000/g | Value = ₹70,000 |
| 8.3 | 22K purity factor | 10g at 22K, price ₹7000/g | Value = 10 × 7000 × (22/24) = ₹64,167 |
| 8.4 | 18K purity factor | 10g at 18K, price ₹7000/g | Value = 10 × 7000 × (18/24) = ₹52,500 |
| 8.5 | Buy transaction updates weight | Add buy: 5g | weight_grams in detail updated to 15g |
| 8.6 | Sell transaction updates weight | Sell 3g | weight_grams updated to 12g |
| 8.7 | Delete buy reverses weight | Delete the 5g buy transaction | weight_grams reverts to 10g |
| 8.8 | Gold forms accepted | Create physical, digital, sovereign_bond | All three forms stored correctly |
| 8.9 | Gold price fetch | Trigger market data fetch | Gold price fetched (Yahoo GC=F), converted USD/oz → INR/gram |
| 8.10 | Gold with no cached price | Create gold, no price in DB | Current value = ₹0 |

---

## 9. Loans (7)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.1 | Create loan | Enter principal ₹50L, rate 8.5%, EMI ₹48,000 → save | Loan created with `investment_loan` detail |
| 9.2 | Loan outstanding calculation | Loan started 12 months ago | Outstanding = principal − amortized principal payments |
| 9.3 | Loan shown as negative value | View dashboard | Loan value subtracted from net worth |
| 9.4 | Loan gain always zero | View loan card | Gain = 0, gain% = 0 |
| 9.5 | Loan types | Create home, car, personal, education, gold, other | All loan types stored correctly |
| 9.6 | EMI transaction | Add EMI transaction ₹48,000 | Transaction recorded |
| 9.7 | Loan excluded from XIRR | View loan investment | XIRR = null |

---

## 10. Fixed Assets (6)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 10.1 | Create fixed asset | Category=property, price ₹50L, inflation 6% → save | Asset created in `investment_fixed_asset` |
| 10.2 | Asset appreciation calculation | ₹50L property, 6% inflation, 5 years ago | Value = 50L × (1.06)^5 ≈ ₹66.9L |
| 10.3 | Invested = purchase price (no txns) | Create asset, no transactions | Invested amount = purchase_price_paise |
| 10.4 | Asset categories | Create property, vehicle, jewelry, art, other | All categories accepted |
| 10.5 | Edit inflation rate | Change from 6% to 8% | Value recalculated with new rate |
| 10.6 | Manual override on asset | Set override value ₹75L | Override shown instead of calculated value |

---

## 11. Pension & Savings (6)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.1 | Create pension (PPF) | Type=ppf, rate=7.1%, account number → save | Created in `investment_pension` |
| 11.2 | Pension value = deposits compounded | Deposits totaling ₹5L over 3 years at 7.1% | Value includes compound interest on deposits |
| 11.3 | Pension types accepted | Create nps, epf, ppf, gratuity, other | All types stored correctly |
| 11.4 | Create savings account | Bank name, account number, rate 4% → save | Created in `investment_savings_account` |
| 11.5 | Savings value = net deposits | Deposit ₹1L, withdraw ₹20K | Value = ₹80,000 (no compounding) |
| 11.6 | Savings bank details optional | Create without bank_name, ifsc | Created with null optional fields |

---

## 12. Transactions (14)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.1 | Add buy transaction | Select buy, enter date, amount, units, price | Transaction created, lot created for MF/shares |
| 12.2 | Add sell transaction (general) | Select sell, enter date, amount | Transaction created |
| 12.3 | Add SIP transaction | Select sip, enter amount + units + NAV | Transaction + lot created |
| 12.4 | Add deposit transaction | Select deposit, enter amount | Transaction created |
| 12.5 | Add withdrawal transaction | Select withdrawal, enter amount | Transaction created |
| 12.6 | Add dividend transaction | Select dividend, enter amount | Transaction created, no lot |
| 12.7 | Add interest transaction | Select interest, enter amount | Transaction created |
| 12.8 | Edit transaction amount | Change amount from ₹5000 to ₹6000 | Amount updated |
| 12.9 | Delete transaction | Delete a transaction | Transaction removed |
| 12.10 | Transaction validation — missing date | Submit without date | Validation error |
| 12.11 | Transaction validation — negative amount | Submit amount = -100 | Validation error: must be positive |
| 12.12 | Transaction validation — invalid date format | Submit date "15/02/2025" | Validation error: must be YYYY-MM-DD |
| 12.13 | Fees field optional and defaults to 0 | Submit transaction without fees | fees_paise = 0 |
| 12.14 | Clear all transactions | Click "Clear all transactions" in settings | All user transactions deleted |

---

## 13. Recurring Transactions (12)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 13.1 | Create monthly recurring rule | Investment, SIP, ₹5000, monthly, day=15 | Rule created with frequency=monthly |
| 13.2 | Create daily recurring rule | Deposit, ₹100, daily | Rule created with frequency=daily |
| 13.3 | Create weekly recurring rule | Deposit, ₹1000, weekly | Rule created with frequency=weekly |
| 13.4 | Create yearly recurring rule | Premium, ₹50000, yearly | Rule created with frequency=yearly |
| 13.5 | Generate pending transactions | Click "Generate" with overdue rules | Transactions created for each missed occurrence |
| 13.6 | Monthly generation respects day_of_month | Rule on 31st, February month | Caps to 28/29 (month end) |
| 13.7 | Generation stops at end_date | Rule with end_date in past | No new transactions generated |
| 13.8 | MF recurring fetches NAV for date | SIP rule generates for MF | Units calculated from amount / date-specific NAV |
| 13.9 | Shares recurring fetches price | Recurring buy for shares | Units calculated from amount / date-specific price |
| 13.10 | Recurring skips if price unavailable | MF with no available NAV for date | That occurrence skipped |
| 13.11 | Delete recurring rule | Delete a rule | Rule removed, past generated transactions remain |
| 13.12 | Deactivate recurring rule | Set is_active = false | Rule skipped during generation |

---

## 14. Goals & Projections (18)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 14.1 | Create goal | Name "House", target ₹50L, date 2030-01-01 → save | Goal created |
| 14.2 | Edit goal target | Change target from ₹50L to ₹60L | Target updated |
| 14.3 | Delete goal | Delete a goal | Goal and goal_investments removed |
| 14.4 | Assign investment to goal | Assign MF with 100% allocation | goal_investments record created |
| 14.5 | Assign with partial allocation | Assign MF with 50% allocation | Allocation = 50% |
| 14.6 | Remove investment from goal | Remove assignment | goal_investments record deleted |
| 14.7 | Investment limited to one goal | Assign investment already in another goal | Error: already assigned |
| 14.8 | Goal progress calculation | Target ₹10L, assigned investments worth ₹6L at 100% | Progress = 60% |
| 14.9 | Goal progress with partial allocation | Target ₹10L, investment worth ₹6L at 50% | Progress = 30% (₹3L / ₹10L) |
| 14.10 | Loan reduces goal progress | Assign loan to goal | Loan value subtracted from goal total |
| 14.11 | Track chart — actual line | Click track on goal with snapshots | Green area showing historical monthly values |
| 14.12 | Track chart — projected line | Goal with future target date | Blue dashed line from current value compounding forward |
| 14.13 | Track chart — ideal path | Goal with target and start date | Orange line showing compound growth curve to target |
| 14.14 | Goal with past target date | Target date in past | Actual history shown, no projected line |
| 14.15 | Simulate — will meet goal | SIP ₹10K/month, return 12%, target achievable | will_meet_goal = true, projected ≥ target |
| 14.16 | Simulate — shortfall | SIP ₹1K/month, low return, large target | will_meet_goal = false, shortfall amount shown |
| 14.17 | Goal priority ordering | Create goals with priority 1, 5, 10 | Goals sortable/displayed by priority |
| 14.18 | Ideal path uses weighted average rate | Assign FD (7%) and MF (12%) with equal allocation | Ideal path uses blended ~9.5% rate |

---

## 15. Snapshots & Net Worth (16)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.1 | Calculate current snapshot | Click "Calculate Snapshots" | monthly_snapshots + net_worth_snapshots created for current month |
| 15.2 | Snapshot per-investment values | Calculate with 3 investments | 3 rows in monthly_snapshots, each with invested + value |
| 15.3 | Net worth snapshot aggregation | Calculate with mix of investments and loans | net_worth = total_value − total_debt |
| 15.4 | Snapshot breakdown JSON | Calculate snapshot | breakdown_json contains per-type totals |
| 15.5 | Snapshot replaces existing month | Calculate twice for same month | No duplicates, values updated |
| 15.6 | Net worth chart | View dashboard after snapshots exist | Area chart with invested and net worth lines |
| 15.7 | Generate historical snapshots | Click "Generate Historical" | ~46 snapshots created (36 monthly + 10 yearly) |
| 15.8 | Historical FD valuation | FD created 2 years ago, generate historical | Past months show compound interest value at that date |
| 15.9 | Historical MF valuation | MF with transactions, generate historical | Past months use units-as-of-date × NAV-as-of-date |
| 15.10 | Historical gold valuation | Gold investment, generate historical | Past months use weight × cached gold price for date |
| 15.11 | Historical skips future investments | Investment created 3 months ago, generate for 12 months back | Only last 3 months include that investment |
| 15.12 | Snapshot list page | Navigate to `/snapshots` | All snapshots listed newest first with invested, value, gain |
| 15.13 | Snapshot detail — expand row | Click on a snapshot month | Shows investments grouped by type |
| 15.14 | Snapshot detail — per-type totals | Expand month with MF + FD | Each type group shows count, total invested, total value |
| 15.15 | Snapshot detail — individual investments | Expand a type group | Individual investment names with invested/value columns |
| 15.16 | Clear snapshots | Click "Clear Snapshots" in settings | All snapshot data deleted |

---

## 16. Tax Calculation (10)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 16.1 | Calculate tax for FY | Select FY 2025-26 → calculate | Tax summary returned |
| 16.2 | Equity STCG — holding < 365 days | Sell equity shares held 6 months, gain ₹50K | STCG at 20% = ₹10,000 |
| 16.3 | Equity LTCG — holding > 365 days | Sell shares held 2 years, gain ₹2L | LTCG at 12.5% after ₹1.25L exemption = ₹9,375 |
| 16.4 | Equity LTCG exemption applied | LTCG gains total ₹1L (under ₹1.25L) | Tax = ₹0 (fully exempt) |
| 16.5 | Debt STCG — holding < 3 years | Sell debt MF held 1 year, gain ₹30K | STCG at 30% (slab rate) = ₹9,000 |
| 16.6 | Debt LTCG — holding > 3 years | Sell debt MF held 4 years, gain ₹50K | LTCG at 20% = ₹10,000 |
| 16.7 | Tax uses FIFO cost basis | Buy 100 at ₹50, buy 100 at ₹60, sell 120 | Cost = (100×50) + (20×60), not average |
| 16.8 | No sells in FY — zero tax | FY with no sell transactions | Empty gains array, total tax = 0 |
| 16.9 | Mixed equity + debt gains | Sell MF equity + MF debt in same FY | Separate STCG/LTCG for each category |
| 16.10 | Tax detail table | View tax page after calculation | Table shows each sale with investment name, type, dates, gain, tax |

---

## 17. Market Data (10)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 17.1 | Fetch all market data | Click "Fetch Market Data" | MF NAVs, stock prices, gold price all updated |
| 17.2 | MF NAV cached | Fetch NAV for AMFI code | Stored in market_prices with source='mfapi' |
| 17.3 | Stock price cached | Fetch price for ticker | Stored in market_prices with source='yahoo' |
| 17.4 | Gold price conversion | Fetch gold price | USD/oz converted to INR/gram (÷31.1035 × exchange rate) |
| 17.5 | Manual price overrides automatic | Set manual price ₹100, Yahoo has ₹95 | Valuation uses ₹100 (manual source priority) |
| 17.6 | MF scheme search | Search "HDFC" | Returns matching scheme names with AMFI codes |
| 17.7 | Fetch single MF NAV | Call `POST /api/market/fetch-mf/:amfiCode` | NAV for specific fund cached |
| 17.8 | Stock history fetch | Call `GET /api/market/history/:symbol` | 1-year daily prices cached |
| 17.9 | Price lookup for past date | Query price for 3 months ago | Returns closest cached price ≤ target date |
| 17.10 | No duplicate cache entries | Fetch same price twice | UNIQUE constraint prevents duplicates, latest used |

---

## 18. Import / Export (10)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 18.1 | Upload CSV preview | Upload FD CSV file | Returns headers, row count, first 5 rows preview |
| 18.2 | Execute import — FD | Upload + execute FD CSV | FD investments created with details |
| 18.3 | Execute import — transactions | Upload transaction CSV with mapping | Transactions created for matched investments |
| 18.4 | Download template — each type | Click template download for each investment type | CSV template with correct headers |
| 18.5 | Export all investments | Click "Export Investments" | CSV with ID, Type, Name, Institution, Invested, Value, Gain, Active |
| 18.6 | Export investments by type | Export with type=fd filter | Only FD investments in CSV |
| 18.7 | Export all transactions | Click "Export Transactions" | CSV with all transaction fields |
| 18.8 | Export transactions by investment | Export with investment_id filter | Only that investment's transactions |
| 18.9 | Import invalid CSV | Upload malformed file | Error returned with details |
| 18.10 | Import empty CSV | Upload CSV with headers only | No investments created, appropriate message |

---

## 19. Dashboard & Analytics (12)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 19.1 | Quick stats displayed | Login with investments | Cards show: total invested, current value, gain/gain%, net worth |
| 19.2 | Net worth subtracts loans | Have investments (₹10L) + loan (₹5L) | Net worth = ₹5L |
| 19.3 | Breakdown by type — donut chart | Multiple investment types exist | Donut chart with segments per type |
| 19.4 | Breakdown table | View below donut chart | Table with type, count, invested, value per type |
| 19.5 | Net worth area chart | Snapshots exist for multiple months | Area chart with invested vs net worth over time |
| 19.6 | Type history chart | Select a type from dropdown | Line chart showing historical values for that type |
| 19.7 | Empty dashboard | New user with no investments | Empty state shown with call to action |
| 19.8 | XIRR per type | Call `GET /api/analytics/type-xirr/:type` | Returns XIRR for all investments of that type combined |
| 19.9 | Dashboard counts only active | Deactivate an investment | Dashboard totals exclude deactivated investment |
| 19.10 | Gain percentage calculation | Invested ₹1L, value ₹1.2L | Gain = ₹20K, Gain% = 20% |
| 19.11 | Generate Historical button | Click on dashboard | Historical snapshots generated, toast notification |
| 19.12 | Calculate Snapshots button | Click on dashboard | Current month snapshot created |

---

## 20. Settings & Danger Zone (8)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 20.1 | View default type rates | Navigate to settings | All 11 type rates displayed with defaults |
| 20.2 | Update type rates | Change rate_mf_equity to 15% → save | Rate persisted, used in projections |
| 20.3 | Rates used in goal projection | Set rate_mf_equity=15%, project goal with MF | Projection uses 15% growth rate |
| 20.4 | Fetch market data from settings | Click "Fetch Market Data" | All prices updated |
| 20.5 | Calculate snapshots from settings | Click "Calculate Snapshots" | Current month snapshot created |
| 20.6 | Clear all snapshots | Click "Clear Snapshots" | All snapshot data removed |
| 20.7 | Clear all transactions | Click "Clear All Transactions" in danger zone | All user transactions deleted, lots removed |
| 20.8 | Delete all investments | Click "Delete All Investments" in danger zone | All investments, details, transactions, lots removed |

---

## 21. Navigation & UI (5)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 21.1 | Sidebar navigation | Click each nav item | Navigates to correct page, active item highlighted |
| 21.2 | Mobile nav drawer | Open app on mobile width, tap hamburger | Side drawer opens with all nav items |
| 21.3 | Mobile nav closes on selection | Tap a nav item in mobile drawer | Drawer closes, navigates to page |
| 21.4 | 404 redirects to dashboard | Navigate to `/nonexistent` | Redirected to `/` |
| 21.5 | Snapshots nav link present | Check sidebar | "Snapshots" link navigates to `/snapshots` |

---

## 22. Validation & Edge Cases (9)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 22.1 | Zod strips unknown fields | Send extra fields in transaction body | Extra fields silently dropped |
| 22.2 | Paise stored as integers | Create ₹1,234.56 investment | Stored as 123456 paise |
| 22.3 | InrAmount formats correctly | Display 123456 paise | Shows ₹1,234.56 |
| 22.4 | Concurrent snapshot generation | Click generate historical twice quickly | No duplicate snapshots (REPLACE/UPSERT) |
| 22.5 | Investment with no transactions | Create FD, view | Shows calculated values, no transaction list |
| 22.6 | Very large amounts | Create FD with ₹10 crore principal | Handles large integers correctly |
| 22.7 | Special characters in names | Investment name with quotes, ampersands | Stored and displayed correctly |
| 22.8 | Database persistence | Create data, restart server | All data intact from disk save |
| 22.9 | Manual override takes precedence | Set override, check valuation | Override value returned instead of calculated |

---

**Total: 197 test cases**
