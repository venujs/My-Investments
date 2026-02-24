import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Landmark, RotateCcw, TrendingUp, BarChart3,
  Coins, CircleDollarSign, Receipt, Home, PiggyBank,
  Target, Calculator, Camera, Repeat, Upload, Download,
  Settings, BookOpen, ChevronRight,
} from 'lucide-react';

const sections = [
  { id: 'overview',       label: 'Overview & Concepts',     icon: BookOpen },
  { id: 'dashboard',      label: 'Dashboard',               icon: LayoutDashboard },
  { id: 'fd-rd',          label: 'Fixed & Recurring Deposits', icon: Landmark },
  { id: 'mf-shares-gold', label: 'Mutual Funds, Shares & Gold', icon: TrendingUp },
  { id: 'loans-expenses', label: 'Loans & Expenses',        icon: CircleDollarSign },
  { id: 'assets-pension-savings', label: 'Assets, Pension & Savings', icon: Home },
  { id: 'goals',          label: 'Goals',                   icon: Target },
  { id: 'tax',            label: 'Tax & Capital Gains',     icon: Calculator },
  { id: 'snapshots',      label: 'Snapshots & Analytics',   icon: Camera },
  { id: 'data',           label: 'Data Management',         icon: Settings },
];

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 mb-2 font-semibold text-base">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="ml-4 space-y-1 list-disc text-muted-foreground">{children}</ul>;
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 font-medium text-foreground w-36">{label}</span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Tag({ children, color = 'default' }: { children: React.ReactNode; color?: 'green' | 'amber' | 'red' | 'blue' | 'default' }) {
  const cls = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    default: '',
  }[color];
  return <Badge variant={color === 'default' ? 'secondary' : 'outline'} className={cls}>{children}</Badge>;
}

export function HelpPage() {
  const [active, setActive] = useState('overview');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-8">
      {/* Sticky sidebar TOC */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-4 space-y-0.5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contents</p>
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                active === s.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <span className="text-xs text-muted-foreground/60 w-4 shrink-0">{i + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-12 pb-16">
        <div>
          <h1 className="text-3xl font-bold">Help & User Guide</h1>
          <p className="mt-2 text-muted-foreground">A complete reference for My Investments — your personal portfolio tracker.</p>
        </div>

        {/* ── 1. OVERVIEW ── */}
        <Section id="overview" title="Overview & Core Concepts" icon={BookOpen}>
          <P>
            My Investments tracks every type of asset you own — deposits, mutual funds, shares, gold,
            real estate, pension, savings — and gives you a unified view of your net worth, returns,
            and tax liability. All amounts are stored internally in <strong>paise</strong> (1 ₹ = 100 paise)
            to avoid rounding errors, and displayed in rupees throughout the interface.
          </P>

          <H3>Investment Types</H3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ['Fixed Deposit (FD)', 'Lump-sum deposit at a fixed interest rate'],
              ['Recurring Deposit (RD)', 'Monthly instalment deposit at a fixed rate'],
              ['Mutual Fund (MF)', 'Equity, Hybrid, or Debt fund units tracked by NAV'],
              ['Shares', 'Listed stocks tracked by market price (NSE/BSE)'],
              ['Gold', 'Physical, Digital, or Sovereign Bond gold by weight'],
              ['Loan', 'Outstanding borrowings that reduce net worth'],
              ['Expected Expense', 'Future expenses that reduce net worth while active'],
              ['Fixed Asset', 'Property, vehicle, or other assets that appreciate'],
              ['Pension', 'EPF, PPF, NPS, Gratuity, and other pension funds'],
              ['Savings Account', 'Bank savings accounts with deposits and withdrawals'],
            ].map(([name, desc]) => (
              <div key={name} className="rounded-md border bg-card px-3 py-2">
                <p className="font-medium text-xs">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>

          <H3>Key Metrics Explained</H3>
          <div className="space-y-2">
            <Kv label="Invested Amount">Total capital deployed — principal for FD/loan, total buy transactions for MF/shares, purchase price for assets.</Kv>
            <Kv label="Current Value">Live valuation using market prices, interest accrual, or formula-based appreciation.</Kv>
            <Kv label="Gain / Loss">Current Value minus Invested Amount. Shown in green (gain) or red (loss).</Kv>
            <Kv label="Gain %">Gain ÷ Invested × 100. Simple return over the holding period.</Kv>
            <Kv label="XIRR">Extended Internal Rate of Return — annualised return accounting for the timing of every cash flow. More accurate than simple gain % for irregular investments.</Kv>
            <Kv label="Net Worth">Total value of all assets minus all outstanding debt (loans + active expenses).</Kv>
          </div>

          <H3>FIFO Lot Tracking</H3>
          <P>
            Mutual funds and shares use <strong>First-In, First-Out (FIFO)</strong> lot tracking. Each buy
            transaction creates a lot with a quantity and cost price. When you sell, units are
            deducted from the oldest lots first. This is the standard method used for capital
            gains tax computation in India.
          </P>

          <H3>Transactions</H3>
          <P>Most asset types support one or more of these transaction types:</P>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {[
              ['Buy / SIP', 'Purchase of units (MF/shares)'],
              ['Sell', 'Sale of units (triggers FIFO lot deduction)'],
              ['Deposit', 'Cash added to savings/pension accounts'],
              ['Withdrawal', 'Cash removed from savings/pension accounts'],
              ['Interest', 'Interest credited to an account'],
              ['Dividend', 'Dividend payout received'],
              ['EMI', 'Loan repayment instalment'],
              ['Bonus / Split', 'Corporate actions for shares'],
              ['Maturity', 'FD/RD maturity payout'],
            ].map(([type, desc]) => (
              <div key={type} className="flex gap-2 py-0.5">
                <Tag>{type}</Tag>
                <span className="text-muted-foreground text-xs self-center">{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 2. DASHBOARD ── */}
        <Section id="dashboard" title="Dashboard" icon={LayoutDashboard}>
          <P>The dashboard is your portfolio command centre, showing live totals and charts across all assets.</P>

          <H3>Summary Cards</H3>
          <Ul>
            <li><strong>Total Invested</strong> — capital you have deployed, shown with investment count</li>
            <li><strong>Current Value</strong> — live value of all holdings</li>
            <li><strong>Total Gain</strong> — absolute gain and percentage return</li>
            <li><strong>Net Worth</strong> — current value minus all debt and active expected expenses</li>
          </Ul>

          <H3>Charts</H3>
          <Ul>
            <li><strong>Investment Breakdown</strong> — donut chart showing value by asset type</li>
            <li><strong>Net Worth History</strong> — area chart of net worth and invested amount over time (requires snapshots)</li>
            <li><strong>Type History</strong> — pick any investment type to see its invested vs. current value trend</li>
          </Ul>

          <H3>Action Buttons</H3>
          <div className="space-y-1.5">
            <Kv label="Fetch Prices">Downloads latest MF NAVs from mfapi.in and stock prices from Yahoo Finance. Run this daily for up-to-date valuations.</Kv>
            <Kv label="Generate Recurring">Creates pending transactions for all active recurring rules (SIPs, EMIs, etc.) up to today's date.</Kv>
            <Kv label="Calculate Snapshots">Records a snapshot of today's portfolio value into monthly history.</Kv>
            <Kv label="Generate Historical">Backfills historical snapshots for the last 36 months and 10 years. This runs as a background job — progress is shown in a status banner. Required for Net Worth History charts and Goal tracking charts.</Kv>
          </div>

          <Callout>
            Run <strong>Fetch Prices</strong> → <strong>Generate Recurring</strong> → <strong>Calculate Snapshots</strong> at the end of each month to keep history accurate.
          </Callout>
        </Section>

        {/* ── 3. FD / RD ── */}
        <Section id="fd-rd" title="Fixed Deposits & Recurring Deposits" icon={Landmark}>
          <P>
            FDs and RDs are calculated using compound interest formulas — no market data needed.
            Values are computed automatically from principal, rate, compounding frequency, and dates.
          </P>

          <H3>Creating an FD</H3>
          <Ul>
            <li><strong>Principal</strong> — initial deposit amount</li>
            <li><strong>Interest Rate</strong> — annual rate in %</li>
            <li><strong>Compounding</strong> — Monthly / Quarterly / Half-Yearly / Yearly</li>
            <li><strong>Start Date & Maturity Date</strong> — determines tenure and accrued interest</li>
          </Ul>

          <H3>Creating an RD</H3>
          <P>Same fields as FD, but instead of a lump-sum principal you enter a <strong>Monthly Instalment</strong> amount.
          The app counts instalments from the start date to today (capped at maturity) to compute the invested amount and accrued value.</P>

          <H3>Status Badges</H3>
          <div className="flex flex-wrap gap-2 mt-1">
            <Tag color="green">Active</Tag><span className="text-muted-foreground self-center text-xs">— before maturity date</span>
            <Tag color="amber">Matures in Xd</Tag><span className="text-muted-foreground self-center text-xs">— within 90 days of maturity</span>
            <Tag color="red">Matured</Tag><span className="text-muted-foreground self-center text-xs">— past maturity date (value frozen)</span>
            <Tag>Closed Early</Tag><span className="text-muted-foreground self-center text-xs">— closed before maturity with a lower rate</span>
          </div>

          <H3>Close Early</H3>
          <P>
            When a bank closes an FD/RD before maturity (premature withdrawal), use <strong>Close Early</strong>
            on the card. Enter the actual closure date and the reduced interest rate applied by the bank.
            The maturity date is updated and the value is recalculated at the lower rate.
          </P>

          <H3>Maturity Value</H3>
          <P>The card shows both the <em>current accrued value</em> (as of today) and the
          <em>projected maturity value</em> (what you will receive on the maturity date). After maturity, the value is frozen at the maturity amount.</P>
        </Section>

        {/* ── 4. MF / SHARES / GOLD ── */}
        <Section id="mf-shares-gold" title="Mutual Funds, Shares & Gold" icon={TrendingUp}>
          <H3>Mutual Funds</H3>
          <P>
            MF holdings are tracked in <strong>units</strong>. Current value = units × latest NAV.
            Three sub-types are supported: <Tag>Equity</Tag> <Tag>Hybrid</Tag> <Tag>Debt</Tag> —
            each classified differently for tax purposes.
          </P>
          <Ul>
            <li><strong>ISIN Code</strong> — unique identifier for the fund scheme (e.g. INF846K01EW2)</li>
            <li><strong>Scheme Code</strong> — AMFI numeric code used to fetch NAV from mfapi.in</li>
            <li><strong>Search Scheme</strong> — type a fund name in the Add dialog to auto-fill ISIN and Scheme Code</li>
            <li><strong>Folio Number</strong> — your account number with the AMC (optional, for reference)</li>
          </Ul>
          <P>
            <strong>Fetch NAV</strong> on a fund card downloads the latest NAV and also pulls historical NAVs
            needed for accurate snapshot valuations. NAVs are cached locally.
          </P>
          <Callout>
            For SIP investments, use transaction type <Tag>SIP</Tag> (treated identically to Buy for calculations but labelled differently for clarity).
          </Callout>

          <H3>Shares</H3>
          <P>Stock holdings are tracked in <strong>shares (units)</strong>. Current value = shares × latest CMP (Current Market Price).</P>
          <Ul>
            <li><strong>Ticker Symbol</strong> — NSE/BSE symbol (e.g. RELIANCE, TCS)</li>
            <li><strong>Fetch CMP</strong> — pulls the latest closing price from Yahoo Finance</li>
            <li><strong>Set Price</strong> — manually enter a price for a specific date (useful if auto-fetch fails)</li>
            <li><strong>Performance Chart</strong> — shows 1-year price history for the stock</li>
          </Ul>
          <P>
            <strong>Corporate actions:</strong> Use <Tag>Bonus</Tag> to add shares received in a bonus issue,
            and <Tag>Split</Tag> for stock splits (enter the additional shares received after the split).
          </P>

          <H3>Gold</H3>
          <P>Gold is tracked by <strong>weight in grams</strong> and <strong>purity</strong>. Current value = adjusted weight × current gold price.</P>
          <div className="space-y-1">
            <Kv label="Forms">Physical, Digital (e.g. Zerodha Gold), Sovereign Gold Bond</Kv>
            <Kv label="Purity">24K (pure), 22K (≈91.7%), 18K (75%) — purity is factored into the value calculation</Kv>
            <Kv label="Gold Price">Fetched from the market data service; also editable manually via Settings → Fetch Market Data</Kv>
          </div>
          <P>When adding gold, the app auto-creates an initial Buy transaction from the purchase details you enter.</P>
        </Section>

        {/* ── 5. LOANS & EXPENSES ── */}
        <Section id="loans-expenses" title="Loans & Expected Expenses" icon={CircleDollarSign}>
          <H3>Loans</H3>
          <P>
            Loans represent debt — their outstanding balance is <strong>subtracted from net worth</strong>.
            The outstanding amount is calculated automatically using the reducing-balance method from
            principal, interest rate, and EMI.
          </P>
          <Ul>
            <li><strong>Loan Types</strong> — Home, Car, Personal, Education, Gold, Other</li>
            <li><strong>EMI</strong> — monthly payment amount used to compute outstanding balance</li>
            <li><strong>Record Payments</strong> — log EMI or prepayment transactions on the loan card to track actual payment history (does not affect the formula-based outstanding calculation)</li>
          </Ul>
          <Callout>
            The outstanding balance shown is formula-based (principal − repayments via EMI schedule).
            It may differ slightly from your bank statement due to processing dates or prepayments.
          </Callout>

          <H3>Expected Expenses</H3>
          <P>
            An <em>Expected Expense</em> represents a large planned future outflow — for example, home
            renovation, wedding, or a large purchase. While active, it reduces your net worth, reminding
            you that this money is "spoken for."
          </P>
          <div className="space-y-1">
            <Kv label="Start Date">When the expense starts affecting net worth</Kv>
            <Kv label="Expected Date">When the expense will occur (last day it affects net worth)</Kv>
            <Kv label="Amount">The fixed amount deducted from net worth while active</Kv>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Tag>Planned</Tag><span className="text-muted-foreground self-center text-xs">— before start date, no impact yet</span>
            <Tag color="amber">Active</Tag><span className="text-muted-foreground self-center text-xs">— between start and expected date, deducting from net worth</span>
            <Tag>Expired</Tag><span className="text-muted-foreground self-center text-xs">— past expected date, no longer affecting net worth</span>
          </div>
        </Section>

        {/* ── 6. ASSETS / PENSION / SAVINGS ── */}
        <Section id="assets-pension-savings" title="Fixed Assets, Pension & Savings" icon={Home}>
          <H3>Fixed Assets</H3>
          <P>Property, vehicles, jewelry, art, and other physical assets that appreciate over time.</P>
          <Ul>
            <li><strong>Appreciation Rate</strong> — annual % used to grow the purchase price to today's value using compound appreciation formula</li>
            <li><strong>Categories</strong> — Property, Vehicle, Jewelry, Art, Other</li>
            <li><strong>Set Value Override</strong> — manually set the current value for a specific date (e.g. after a professional valuation), overriding the formula</li>
          </Ul>

          <H3>Pension Accounts (EPF, PPF, NPS, Gratuity)</H3>
          <P>
            Pension accounts accumulate contributions and grow at a declared interest rate.
            Current value = total deposits compounded at the account's interest rate from the first contribution date.
          </P>
          <Ul>
            <li><strong>Pension Types</strong> — NPS, EPF, PPF, Gratuity, Other</li>
            <li><strong>Interest Rate</strong> — set this to the current declared rate (e.g. EPF = 8.25%, PPF = 7.1%)</li>
            <li><strong>Transactions</strong> — add Deposit, Interest (year-end credit), or Withdrawal entries</li>
          </Ul>

          <H3>Savings Accounts</H3>
          <P>Regular bank accounts. Balance = sum of all deposit transactions minus withdrawals and transfers out.</P>

          <H3>Set Balance (Pension & Savings)</H3>
          <P>
            When you receive an account statement (e.g. EPF passbook, bank statement), use
            <strong> Set Balance</strong> on the card to enter the actual balance on that date.
            The app computes the difference between the stated balance and its own calculated balance
            and automatically creates a <Tag>Deposit</Tag> or <Tag>Withdrawal</Tag> transaction to reconcile.
            This keeps transaction history intact while correcting any drift.
          </P>
          <Callout>
            Use <strong>Set Balance</strong> whenever you receive an official statement — it is far
            quicker than manually finding and fixing individual transactions.
          </Callout>
        </Section>

        {/* ── 7. GOALS ── */}
        <Section id="goals" title="Goals" icon={Target}>
          <P>
            Goals let you earmark specific investments towards financial targets (retirement corpus,
            house down payment, children's education, etc.) and track your progress over time.
          </P>

          <H3>Creating a Goal</H3>
          <div className="space-y-1">
            <Kv label="Target Amount">The corpus you want to accumulate</Kv>
            <Kv label="Target Date">When you need the money</Kv>
            <Kv label="Start Date">When you started saving for this goal (used for progress charts)</Kv>
            <Kv label="Priority">1 (highest) to 10 (lowest) — for your own reference</Kv>
          </div>

          <H3>Assigning Investments</H3>
          <P>
            Link investments to a goal with an <strong>allocation %</strong>. If an investment is
            100% allocated to a goal, its full current value counts towards the goal. If it is 50%
            allocated (e.g. an MF fund shared between two goals), only half its value is counted.
          </P>

          <H3>Progress Chart</H3>
          <P>
            Requires historical snapshots. Shows three lines:
          </P>
          <Ul>
            <li><strong>Actual</strong> — real portfolio value linked to this goal, month by month</li>
            <li><strong>Projected</strong> — extrapolated from current value and expected return rate</li>
            <li><strong>Ideal Path</strong> — straight line from start to target (what you need to be on track)</li>
          </Ul>
          <P>
            The coloured area between Actual and Ideal shows whether you are ahead or behind schedule.
          </P>

          <H3>SIP Simulator</H3>
          <P>
            Enter a <strong>monthly SIP amount</strong> and expected <strong>annual return %</strong>
            to see when you will reach the target and whether you have a shortfall. The simulator
            projects from today's current value, not from zero.
          </P>
          <div className="flex gap-2 mt-1">
            <Tag color="green">On Track</Tag><span className="text-muted-foreground self-center text-xs">— projected to reach target by target date</span>
            <Tag color="red">Behind</Tag><span className="text-muted-foreground self-center text-xs">— shortfall; increase SIP or extend timeline</span>
          </div>

          <Callout>
            Goals do not restrict or lock any investments — they are purely a view layer that aggregates
            the value of linked investments. You can link the same investment to multiple goals
            with different allocation percentages.
          </Callout>
        </Section>

        {/* ── 8. TAX ── */}
        <Section id="tax" title="Tax & Capital Gains" icon={Calculator}>
          <P>
            The Tax page computes capital gains for a selected financial year based on your recorded
            sell transactions, using FIFO cost basis.
          </P>

          <H3>How to Use</H3>
          <Ul>
            <li>Enter the FY start and end dates (e.g. 2024-04-01 to 2025-03-31) and click Calculate</li>
            <li>The app scans all sell transactions in that period and computes gains using FIFO lot cost basis</li>
          </Ul>

          <H3>Tax Categories (India FY 2024-25)</H3>
          <div className="space-y-2">
            <Kv label="Equity STCG">Equity MF or shares held ≤ 12 months — taxed at 20%</Kv>
            <Kv label="Equity LTCG">Equity MF or shares held {'>'} 12 months — taxed at 12.5% (with ₹1 lakh annual exemption)</Kv>
            <Kv label="Debt STCG">Debt MF, FD, RD held ≤ 36 months — taxed at your income slab rate</Kv>
            <Kv label="Debt LTCG">Debt MF held {'>'} 36 months — taxed at 20% with indexation (post April 2023 rules apply)</Kv>
          </div>

          <H3>Capital Gains Detail Table</H3>
          <P>
            Expandable table showing every sell transaction with: investment name, type, sell date,
            sell proceeds, FIFO cost basis, gain or loss, holding period, LTCG/STCG classification,
            and estimated tax liability. Use this to prepare your ITR.
          </P>

          <Callout>
            Tax computation is based on recorded transactions only. Accuracy depends on correct
            buy/sell entries with proper dates and prices. Verify against your broker's P&L
            statement before filing.
          </Callout>
        </Section>

        {/* ── 9. SNAPSHOTS ── */}
        <Section id="snapshots" title="Snapshots & Analytics" icon={Camera}>
          <P>
            Snapshots are point-in-time records of your portfolio's value. They power the Net Worth
            History chart, Goal progress charts, and the Snapshots page breakdown.
          </P>

          <H3>How Snapshots Work</H3>
          <Ul>
            <li>A snapshot records invested amount, current value, and gain for every investment at a given month</li>
            <li>An aggregate net worth snapshot records total invested, total value, total debt, net worth, and a per-type breakdown</li>
            <li>Historical snapshots are generated by re-computing valuations at the 1st of each past month using historical prices (NAV, stock prices) and formulas</li>
          </Ul>

          <H3>Types of Snapshot Generation</H3>
          <div className="space-y-1">
            <Kv label="Calculate Snapshots">Records today's values — run this at the end of each month to build up history month by month</Kv>
            <Kv label="Generate Historical">Backfills the last 36 months and 10 years in one go — use this when you first set up the app or after adding many past investments</Kv>
          </div>

          <H3>Snapshots Page</H3>
          <P>Lists all recorded months with total invested, current value, and net worth for each.
          Expanding a month shows the breakdown by investment type, including per-type gain %, XIRR,
          and (if goals exist) goal progress at that date.</P>

          <Callout>
            Historical accuracy depends on cached market data. For MF funds, fetch NAV history using
            the <strong>Fetch NAV</strong> button on each fund card before generating historical snapshots.
            For shares, use <strong>Fetch CMP</strong> or <strong>Performance Chart</strong> to load historical prices.
          </Callout>
        </Section>

        {/* ── 10. DATA MANAGEMENT ── */}
        <Section id="data" title="Data Management" icon={Settings}>
          <H3>Recurring Rules</H3>
          <P>
            Automate regular transactions (SIP, EMI, Deposit, Premium) using recurring rules.
            Set the amount, frequency (Daily / Weekly / Monthly / Yearly), day of month, and date range.
            Click <strong>Generate Recurring</strong> on the Dashboard (or the button on the Recurring page)
            to create all pending transactions up to today.
          </P>
          <Callout>
            RD investments automatically create a monthly recurring deposit rule when you add them.
            Deactivating or closing an RD early also deactivates its rule.
          </Callout>

          <H3>Import (CSV)</H3>
          <P>Bulk-import investments and transactions from CSV files. Available on the Import page:</P>
          <Ul>
            <li>Select the investment type, upload a CSV, and map columns to the app's fields</li>
            <li>Download a template CSV for each type to see the expected column format</li>
            <li>The import report shows rows created, transactions created, and any row-level errors</li>
          </Ul>

          <H3>Export (CSV)</H3>
          <P>Export your data at any time from the Export page — all investments, all transactions, or filtered by type. Useful for backup or for analysis in Excel/Sheets.</P>

          <H3>Settings</H3>
          <div className="space-y-1">
            <Kv label="Default Return Rates">Set annual appreciation rates per investment type. These are used by the Goal Simulator to project future values.</Kv>
            <Kv label="Fetch Market Data">Manually trigger a full refresh of MF NAVs, stock prices, and gold prices.</Kv>
            <Kv label="Multiple Users">The app supports multiple user accounts. Each user's portfolio is completely separate. Admins can manage users.</Kv>
          </div>

          <H3>Danger Zone</H3>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1.5">
            <Kv label="Clear Transactions">Deletes all transaction records, lots and lot allocations. Investment records are kept. Cannot be undone.</Kv>
            <Kv label="Delete All Investments">Deletes all investments and everything linked to them (transactions, goals, snapshots, recurring rules). Cannot be undone.</Kv>
            <Kv label="Purge All Data">Nuclear option — deletes everything except user accounts. Requires typing "PURGE" to confirm. Cannot be undone.</Kv>
          </div>

          <H3>Data Storage</H3>
          <P>
            All data is stored locally in a SQLite database file (<code>data/my-investments.db</code>)
            on the server. The file is saved to disk automatically after every write.
            Back it up regularly by copying this file.
          </P>
        </Section>

        <div className="border-t pt-6 text-xs text-muted-foreground">
          My Investments · Personal portfolio tracker · All data stored locally
        </div>
      </div>
    </div>
  );
}
